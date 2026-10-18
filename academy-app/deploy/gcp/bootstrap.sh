#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run bootstrap as root.' >&2; exit 1; }
disk=/dev/disk/by-id/google-hangang-data
[[ -b "$disk" ]] || { echo 'Attach the dedicated hangang-data disk first.' >&2; exit 1; }
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian %s stable\n' "$(dpkg --print-architecture)" "$VERSION_CODENAME" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
# Only format the dedicated, explicitly named data disk when it has no filesystem.
if [[ -z "$(blkid -s TYPE -o value "$disk" || true)" ]]; then
  [[ -z "$(lsblk -nr -o MOUNTPOINT "$disk" | tr -d '[:space:]')" ]] || exit 1
  mkfs.ext4 -m 0 -L hangang-data "$disk"
fi
[[ "$(blkid -s TYPE -o value "$disk")" == ext4 ]] || { echo 'Expected ext4 data disk.' >&2; exit 1; }
mkdir -p /srv/hangang-academy /opt/hangang-academy/releases
disk_uuid=$(blkid -s UUID -o value "$disk")
if ! grep -Fq "UUID=$disk_uuid " /etc/fstab; then
  printf 'UUID=%s /srv/hangang-academy ext4 defaults 0 2\n' "$disk_uuid" >> /etc/fstab
fi
mountpoint -q /srv/hangang-academy || mount /srv/hangang-academy
mkdir -p /srv/hangang-academy/{data/uploads,backups,caddy/data,caddy/config}
chown -R 1000:1000 /srv/hangang-academy/data /srv/hangang-academy/backups
chmod 700 /srv/hangang-academy/data /srv/hangang-academy/backups
# Never start Docker against an empty mountpoint after a disk/mount failure.
mkdir -p /etc/systemd/system/docker.service.d
printf '[Unit]\nRequiresMountsFor=/srv/hangang-academy\n' > /etc/systemd/system/docker.service.d/hangang-storage.conf
systemctl daemon-reload
echo 'Hangang host and persistent storage ready.'
