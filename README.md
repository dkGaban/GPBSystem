# GBP Service Backend

## Environment

Copy `.env.example` to `.env` and set the SQL Server, `JWT_SECRET`, and
`ADMIN_DEFAULT_PASSWORD` values before starting the server. `JWT_SECRET` is
required in every environment; production also requires
`ADMIN_DEFAULT_PASSWORD`.

## Database migrations

Install dependencies, configure the environment, then apply versioned MSSQL
migrations with:

```sh
npm run migrate
```

Application startup also runs pending migrations before listening. Future schema
changes belong in a new file under `migrations/`; do not add schema checks to
the server boot path.

## Tests

Run the unit and mocked auth endpoint tests with:

```sh
npm test
```
