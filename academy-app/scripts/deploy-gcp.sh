#!/usr/bin/env bash
set -Eeuo pipefail
app_dir=$(cd "$(dirname "$0")/.." && pwd)
repo_dir=$(git -C "$app_dir" rev-parse --show-toplevel)
config="$app_dir/.deploy/gcp.env"
[[ -f "$config" ]] || { echo 'Copy deploy/gcp/config.env.example to .deploy/gcp.env first.' >&2; exit 1; }
# Local configuration contains target identifiers only, never app credentials.
source "$config"
: "${GCP_PROJECT:?}" "${GCP_ZONE:?}" "${GCP_INSTANCE:?}" "${GCP_SSH_USER:?}"
gcloud_bin=${GCLOUD_BIN:-gcloud}
if ! command -v "$gcloud_bin" >/dev/null; then
  for candidate in "$HOME/google-cloud-sdk/bin/gcloud" /opt/homebrew/share/google-cloud-sdk/bin/gcloud; do
    if [[ -x "$candidate" ]]; then gcloud_bin=$candidate; break; fi
  done
fi
command -v "$gcloud_bin" >/dev/null || { echo 'Install Google Cloud CLI and run gcloud auth login.' >&2; exit 1; }
[[ $(git -C "$repo_dir" branch --show-current) == codex/anvarjon-work ]] || { echo 'Deploy from codex/anvarjon-work.' >&2; exit 1; }
[[ -z "$(git -C "$repo_dir" status --porcelain)" ]] || { echo 'Commit your changes before deploying.' >&2; exit 1; }
release="$(git -C "$repo_dir" rev-parse --short=12 HEAD)-$(date -u +%Y%m%dT%H%M%SZ)"
archive="$app_dir/.deploy/hangang-$release.tar.gz"
umask 077
git -C "$repo_dir" archive --format=tar.gz --output="$archive" HEAD:academy-app
common=(--project="$GCP_PROJECT" --zone="$GCP_ZONE" --quiet)
if [[ -n ${GCP_SSH_KEY:-} ]]; then common+=(--ssh-key-file="$GCP_SSH_KEY"); fi
remote="$GCP_SSH_USER@$GCP_INSTANCE"
echo "Uploading committed release $release..."
"$gcloud_bin" compute scp "$archive" "$remote:/tmp/hangang-$release.tar.gz" "${common[@]}"
"$gcloud_bin" compute ssh "$remote" "${common[@]}" \
  --command="mkdir -p '/tmp/hangang-$release-runner' && tar -xzf '/tmp/hangang-$release.tar.gz' -C '/tmp/hangang-$release-runner' deploy/gcp/release.sh && sudo bash '/tmp/hangang-$release-runner/deploy/gcp/release.sh' '$release' </dev/null"
echo "Deploy complete: $release"
