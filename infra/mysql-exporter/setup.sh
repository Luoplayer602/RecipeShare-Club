#!/usr/bin/env bash
set -eu

password=$(cat /run/secrets/mysql_monitor_password)
if [[ ! "$password" =~ ^[a-f0-9]{64}$ ]]; then
    echo 'Invalid MySQL monitoring secret format.' >&2
    exit 1
fi

# Sharing only MySQL's network namespace allows root@localhost authentication;
# the initializer never receives the Docker socket or publishes any port.
export MYSQL_PWD="$(cat /run/secrets/mysql_root_password)"
grants=$(mysql --protocol=TCP --host=127.0.0.1 --user=root --batch --skip-column-names <<SQL
CREATE USER IF NOT EXISTS 'recipe_monitor'@'%' IDENTIFIED BY '$password' WITH MAX_USER_CONNECTIONS 3;
SHOW GRANTS FOR 'recipe_monitor'@'%';
SQL
)
if [[ "$grants" != 'GRANT USAGE ON *.* TO `recipe_monitor`@`%`' ]]; then
    echo 'Refusing to reuse recipe_monitor: expected a dedicated USAGE-only account.' >&2
    exit 1
fi
mysql --protocol=TCP --host=127.0.0.1 --user=root --batch <<SQL
ALTER USER 'recipe_monitor'@'%' IDENTIFIED BY '$password' WITH MAX_USER_CONNECTIONS 3;
SQL
echo 'MySQL monitoring account initialized (USAGE only; at most 3 connections).'
