# Initial Railway review migration

The normal source checkout contains no review database here. For the first deployment only, the prepared `initial-studio.sqlite` can be included in a private deployment archive, with its SHA-256 supplied as `INITIAL_DB_SHA256` in Railway Variables.

Startup verifies that fingerprint and copies the database into the persistent volume only when `studio.sqlite` does not already exist. It never replaces an existing database. This preserves the team's existing content review instead of creating another approval.

Do not commit the database to a repository. Future deployments can omit it while the persistent database exists.
