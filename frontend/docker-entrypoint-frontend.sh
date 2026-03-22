#!/bin/sh
set -e
UP="${BACKEND_UPSTREAM:-backend:8000}"
sed "s|__BACKEND_UPSTREAM__|${UP}|g" /tmp/nginx.docker.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
