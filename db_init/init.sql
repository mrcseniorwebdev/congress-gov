create user IF NOT EXISTS 'user'@'%' identified by 'pass';
grant all privileges on *.* to 'user'@'%' with grant option;
flush privileges;
create database if not exists congressgovdb;
use congressgovdb;

CREATE TABLE IF NOT EXISTS cache (
    zip VARCHAR(255),
    response TEXT
);
