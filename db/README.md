# Database

The local PostgreSQL container runs SQL files from `db/init/` when its data
volume is first created. The skeleton uses this to create a tiny metadata table
that lets the API database smoke check verify both connectivity and bootstrap.

If init SQL changes after a local database has already been created, recreate
the local Postgres volume before expecting the new init scripts to run.
