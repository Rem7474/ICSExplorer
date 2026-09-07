#!/bin/sh
set -e

if [ $# -eq 0 ] || [ "${1#-}" != "$1" ]; then
    set -- /usr/local/bin/icsexplorer "$@"
fi

if [ "$(id -u)" = "0" ]; then
    if [ -n "$PUID" ] && [ "$PUID" != "10001" ]; then
        sed -i "s/^appuser:x:10001:/appuser:x:$PUID:/" /etc/passwd
    fi
    if [ -n "$PGID" ] && [ "$PGID" != "10001" ]; then
        sed -i "s/^appgroup:x:10001:/appgroup:x:$PGID:/" /etc/group
    fi

    DATA_DIR="${DATA_DIR:-/app/data}"
    mkdir -p "${OUTPUT_DIR:-$DATA_DIR/output}" "${ROOMS_OUTPUT_DIR:-$DATA_DIR/rooms}"

    if [ -d /app/seed-data ]; then
        for f in /app/seed-data/*.txt; do
            if [ -f "$f" ]; then
                fname=$(basename "$f")
                if [ ! -f "$DATA_DIR/$fname" ]; then
                    cp "$f" "$DATA_DIR/$fname"
                fi
            fi
        done
    fi

    chown -R appuser:appgroup "$DATA_DIR" 2>/dev/null || true
    chmod -R 775 "$DATA_DIR" 2>/dev/null || true

    exec su-exec appuser "$@"
fi

exec "$@"
