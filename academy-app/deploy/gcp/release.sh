#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || exit 1
release=${1:?Release ID is required}
[[ "$release" =~ ^[a-f0-9]{12}-[0-9]{8}T[0-9]{6}Z$ ]] || exit 1
exec 9>/var/lock/hangang-academy-deploy.lock
flock -n 9 || { echo 'Another Hangang deploy is running.' >&2; exit 1; }
mountpoint -q /srv/hangang-academy || { echo 'Persistent disk is not mounted.' >&2; exit 1; }
[[ -s /srv/hangang-academy/.env ]] || { echo 'Install the private production .env first.' >&2; exit 1; }
root=/opt/hangang-academy
destination="$root/releases/$release"
[[ ! -e "$destination" ]] || { echo 'Release already exists.' >&2; exit 1; }
mkdir -p "$destination"
tar -xzf "/tmp/hangang-$release.tar.gz" -C "$destination"
image="hangang-academy:$release"
docker build --pull --build-arg NODE_OPTIONS=--max-old-space-size=2048 -t "$image" "$destination"
printf 'HANGANG_IMAGE=%s\n' "$image" > "$destination/deploy.env"
chmod 600 "$destination/deploy.env"
compose() {
  local folder=$1; shift
  docker compose --project-name hangang-academy \
    --env-file /srv/hangang-academy/.env --env-file "$folder/deploy.env" \
    -f "$folder/compose.gcp.yaml" "$@" </dev/null
}
previous=$(readlink -f "$root/current" || true)
recover() {
  echo 'Deploy failed. Restoring previous application image.' >&2
  if [[ -n "$previous" && -f "$previous/deploy.env" ]]; then
    compose "$previous" up -d --wait --wait-timeout 240 || true
  fi
}
trap recover ERR
if [[ -n "$previous" && -f "$previous/deploy.env" ]]; then
  compose "$previous" exec -T app npm run backup
  compose "$previous" stop worker backup app
fi
compose "$destination" up -d --wait --wait-timeout 240
ln -sfn "$destination" "$root/current"
if [[ -n "$previous" && "$previous" != "$destination" ]]; then
  ln -sfn "$previous" "$root/previous"
fi
trap - ERR
compose "$destination" ps
echo "Published $image. Persistent data and backups were retained."
