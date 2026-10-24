#!/usr/bin/env bash
set -eu
if [[ ! "$DB_NAME" =~ ^[a-zA-Z0-9_]+$ ]]; then
    echo 'Use only letters, digits and underscores in MYSQL_DATABASE.' >&2
    exit 1
fi
password_hex=$(od -An -v -tx1 /run/secrets/mysql_app_password | tr -d ' \n')
export MYSQL_PWD="$(cat /run/secrets/mysql_root_password)"
mysql --protocol=TCP --host=127.0.0.1 --user=root --batch <<SQL
SET @app_password = CONVERT(UNHEX('$password_hex') USING utf8mb4);
SET @create_user = CONCAT('CREATE USER IF NOT EXISTS ''recipe_app''@''%'' IDENTIFIED BY ', QUOTE(@app_password));
PREPARE create_user FROM @create_user;
EXECUTE create_user;
DEALLOCATE PREPARE create_user;
SET @update_user = CONCAT('ALTER USER ''recipe_app''@''%'' IDENTIFIED BY ', QUOTE(@app_password));
PREPARE update_user FROM @update_user;
EXECUTE update_user;
DEALLOCATE PREPARE update_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON \`$DB_NAME\`.* TO 'recipe_app'@'%';
SQL
echo 'Application database account initialized with DML permissions.'
