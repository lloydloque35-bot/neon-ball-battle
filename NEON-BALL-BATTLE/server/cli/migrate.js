#!/usr/bin/env node
'use strict';
/** Applies pending database migrations (also runs automatically on server start). */
const { buildConfig } = require('../config');
const { DB } = require('../db');
const db = new DB(buildConfig().dbFile);
const applied = db.migrate();
console.log(applied.length ? '✔ Applied: ' + applied.join(', ') : '✔ Database is up to date');
db.close();
