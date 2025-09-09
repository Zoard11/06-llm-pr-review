# FastAPI Template

A simple FastAPI template with database integration using SQLAlchemy and SQLite.

## Features

- FastAPI web framework
- SQLAlchemy ORM with SQLite database, using async engine
- Pydantic models for data validation
- User management endpoints
- Environment configuration with python-dotenv
- Development dependencies for testing and code formatting

## Installation

This project uses `uv` for dependency management. Make sure you have `uv` installed:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Install dependencies:

```bash
uv sync
```

## Running the Application

### Development Mode (with auto-reload)

```bash
uv run uvicorn main:app --reload
```

### Production Mode

```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

The application will be available at `http://localhost:8000`

## API Endpoints

- `GET /` - Welcome message
- `POST /users/` - Create a new user
- `GET /users/` - Get all users

## Example Usage

### Create a user

```bash
curl -X POST "http://localhost:8000/users/" \
     -H "Content-Type: application/json" \
     -d '{"name": "John Doe", "email": "john@example.com"}'
```

### Get all users

```bash
curl -X GET "http://localhost:8000/users/"
```

## Configuration

Create a `.env` file in the project root to customize settings:

```env
APP_NAME=My FastAPI App
DATABASE_URL=sqlite+aiosqlite:///./app.db
DEBUG=true
```

## Database

The application uses SQLite by default, using the aiosqlite engine. The database file (`app.db`) will be created automatically when you first run the application.

## Development

Run tests:

```bash
uv run pytest
```

Format code:

```bash
uv run black .
uv run isort .
```

Lint code:

```bash
uv run flake8 .
```
