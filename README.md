# Lettarboxd (Blu777 fork)

Automatically sync your Letterboxd lists to Radarr for seamless movie management.

> This is a maintained fork of [ryanpag3/lettarrboxd](https://github.com/ryanpag3/lettarrboxd)
> that ships the fix for
> [issue #42](https://github.com/ryanpag3/lettarrboxd/issues/42)
> (Letterboxd changed its film-page markup, breaking film-ID extraction).
> Published on Docker Hub as
> [`blu777/lettarboxd`](https://hub.docker.com/r/blu777/lettarboxd).

## Overview

Lettarboxd is an application that monitors your Letterboxd lists (watchlists, regular lists, watched movies, filmographies, collections, etc.) and automatically pushes new movies to Radarr. It runs continuously, checking for updates at configurable intervals and only processing new additions to avoid duplicate API calls.

## Supported Letterboxd URLs

The application supports various types of Letterboxd URLs for the `LETTERBOXD_URL` environment variable:

- **Watchlists**: `https://letterboxd.com/username/watchlist/`
- **Regular Lists**: `https://letterboxd.com/username/list/list-name/`
- **Watched Movies**: `https://letterboxd.com/username/films/`
- **Collections**: `https://letterboxd.com/films/in/collection-name/`
- **Popular Movies**: `https://letterboxd.com/films/popular/`
- **Actor Filmography**: `https://letterboxd.com/actor/actor-name/`
- **Director Filmography**: `https://letterboxd.com/director/director-name/`
- **Writer Filmography**: `https://letterboxd.com/writer/writer-name/`

### Examples
```bash
# User's watchlist
LETTERBOXD_URL=https://letterboxd.com/moviefan123/watchlist/

# User's custom list
LETTERBOXD_URL=https://letterboxd.com/dave/list/official-top-250-narrative-feature-films/

# User's watched movies
LETTERBOXD_URL=https://letterboxd.com/moviefan123/films/

# Movie collection
LETTERBOXD_URL=https://letterboxd.com/films/in/the-dark-knight-collection/

# Popular movies
LETTERBOXD_URL=https://letterboxd.com/films/popular/

# Another user's list
LETTERBOXD_URL=https://letterboxd.com/criterion/list/the-criterion-collection/

# Actor filmography (e.g., Tom Hanks)
LETTERBOXD_URL=https://letterboxd.com/actor/tom-hanks/

# Director filmography (e.g., Christopher Nolan)
LETTERBOXD_URL=https://letterboxd.com/director/christopher-nolan/

# Writer filmography (e.g., Aaron Sorkin)
LETTERBOXD_URL=https://letterboxd.com/writer/aaron-sorkin/
```

**Note**: All Letterboxd lists must be public for the application to access them.

## Quick Start

### Docker

Pull the image from Docker Hub:

```bash
docker pull blu777/lettarboxd:v1.0
```

Available tags:

| Tag | Description |
|-----|-------------|
| `v1.0`, `v1.0.0` | Pinned to the 1.0 release (recommended for production). |
| `v1` | Latest 1.x release. |
| `latest` | Latest release on the `main` branch. |
| `staging` | Head of `main`; may be unstable. |

```bash
docker run -d \
  --name lettarboxd \
  -e LETTERBOXD_URL=https://letterboxd.com/your_username/watchlist/ \
  -e RADARR_API_URL=http://your-radarr:7878 \
  -e RADARR_API_KEY=your_api_key \
  -e RADARR_QUALITY_PROFILE="HD-1080p" \
  -e RADARR_TAGS="watchlist,must-watch" \
  -e DRY_RUN=false \
  blu777/lettarboxd:v1.0
```

For testing purposes, you can enable dry run mode:
```bash
docker run -d \
  --name lettarboxd-test \
  -e LETTERBOXD_URL=https://letterboxd.com/your_username/watchlist/ \
  -e RADARR_API_URL=http://your-radarr:7878 \
  -e RADARR_API_KEY=your_api_key \
  -e RADARR_QUALITY_PROFILE="HD-1080p" \
  -e DRY_RUN=true \
  blu777/lettarboxd:v1.0
```
See [docker-compose.yaml](./docker-compose.yaml) for complete example.

## Watching Multiple Lists

To monitor multiple Letterboxd lists simultaneously, deploy one lettarboxd instance per list. Each instance operates independently with its own configuration, allowing you to:

- Watch different lists with different quality profiles
- Use custom tags to organize movies from different sources
- Set different check intervals for each list
- Maintain separate data directories to track each list's state

### Docker Compose Multi-List Example

```yaml
services:
  lettarboxd-watchlist:
    image: blu777/lettarboxd:v1.0
    container_name: lettarboxd-watchlist
    environment:
      - LETTERBOXD_URL=https://letterboxd.com/your_username/watchlist/
      - RADARR_API_URL=http://radarr:7878
      - RADARR_API_KEY=your_api_key
      - RADARR_QUALITY_PROFILE=HD-1080p
      - RADARR_TAGS=watchlist,personal
      - CHECK_INTERVAL_MINUTES=60
    volumes:
      - ./data/watchlist:/data
    restart: unless-stopped

  lettarboxd-criterion:
    image: blu777/lettarboxd:v1.0
    container_name: lettarboxd-criterion
    environment:
      - LETTERBOXD_URL=https://letterboxd.com/criterion/list/the-criterion-collection/
      - RADARR_API_URL=http://radarr:7878
      - RADARR_API_KEY=your_api_key
      - RADARR_QUALITY_PROFILE=HD-1080p
      - RADARR_TAGS=criterion,classics
      - CHECK_INTERVAL_MINUTES=120
    volumes:
      - ./data/criterion:/data
    restart: unless-stopped

  lettarboxd-nolan:
    image: blu777/lettarboxd:v1.0
    container_name: lettarboxd-nolan
    environment:
      - LETTERBOXD_URL=https://letterboxd.com/director/christopher-nolan/
      - RADARR_API_URL=http://radarr:7878
      - RADARR_API_KEY=your_api_key
      - RADARR_QUALITY_PROFILE=Ultra HD
      - RADARR_TAGS=nolan,director-filmography
      - CHECK_INTERVAL_MINUTES=1440  # Check once per day
    volumes:
      - ./data/nolan:/data
    restart: unless-stopped
```

### Docker CLI Multi-List Example

```bash
# Watch your personal watchlist
docker run -d \
  --name lettarboxd-watchlist \
  -e LETTERBOXD_URL=https://letterboxd.com/your_username/watchlist/ \
  -e RADARR_API_URL=http://radarr:7878 \
  -e RADARR_API_KEY=your_api_key \
  -e RADARR_QUALITY_PROFILE="HD-1080p" \
  -e RADARR_TAGS="watchlist,personal" \
  -e CHECK_INTERVAL_MINUTES=60 \
  -v ./data/watchlist:/data \
  blu777/lettarboxd:v1.0

# Watch the Criterion Collection
docker run -d \
  --name lettarboxd-criterion \
  -e LETTERBOXD_URL=https://letterboxd.com/criterion/list/the-criterion-collection/ \
  -e RADARR_API_URL=http://radarr:7878 \
  -e RADARR_API_KEY=your_api_key \
  -e RADARR_QUALITY_PROFILE="HD-1080p" \
  -e RADARR_TAGS="criterion,classics" \
  -e CHECK_INTERVAL_MINUTES=120 \
  -v ./data/criterion:/data \
  blu777/lettarboxd:v1.0

# Watch Christopher Nolan's filmography
docker run -d \
  --name lettarboxd-nolan \
  -e LETTERBOXD_URL=https://letterboxd.com/director/christopher-nolan/ \
  -e RADARR_API_URL=http://radarr:7878 \
  -e RADARR_API_KEY=your_api_key \
  -e RADARR_QUALITY_PROFILE="Ultra HD" \
  -e RADARR_TAGS="nolan,director-filmography" \
  -e CHECK_INTERVAL_MINUTES=1440 \
  -v ./data/nolan:/data \
  blu777/lettarboxd:v1.0
```

### Best Practices for Multi-List Setup

1. **Unique Container Names**: Each instance must have a unique container name (e.g., `lettarboxd-watchlist`, `lettarboxd-criterion`)

2. **Separate Data Directories**: Use different volume mounts for each instance to maintain independent state tracking:
   ```yaml
   volumes:
     - ./data/watchlist:/data    # Instance 1
     - ./data/criterion:/data    # Instance 2
   ```

3. **Distinctive Tags**: Use the `RADARR_TAGS` variable to organize movies by source:
   ```yaml
   - RADARR_TAGS=watchlist,personal
   - RADARR_TAGS=criterion,classics
   - RADARR_TAGS=nolan,director-filmography
   ```

4. **Appropriate Check Intervals**: Adjust `CHECK_INTERVAL_MINUTES` based on how frequently each list updates:
   - Personal watchlists: 30-60 minutes
   - Curated lists: 2-24 hours
   - Static collections: 24 hours or more

5. **Quality Profiles**: Each instance can use different quality profiles based on content type:
   ```yaml
   - RADARR_QUALITY_PROFILE=HD-1080p      # Standard content
   - RADARR_QUALITY_PROFILE=Ultra HD       # Premium content
   ```

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `LETTERBOXD_URL` | Your Letterboxd list URL | `https://letterboxd.com/moviefan123/watchlist/` |
| `RADARR_API_URL` | Radarr base URL | `http://radarr:7878` |
| `RADARR_API_KEY` | Radarr API key | `abc123...` |
| `RADARR_QUALITY_PROFILE` | Quality profile name in Radarr | `HD-1080p` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CHECK_INTERVAL_MINUTES` | `10` | How often to check for new movies (minimum 10) |
| `RADARR_MINIMUM_AVAILABILITY` | `released` | When movie becomes available (`announced`, `inCinemas`, `released`) |
| `RADARR_ROOT_FOLDER_ID` | - | Specific root folder ID to use in Radarr (uses first available if not set) |
| `RADARR_ADD_UNMONITORED` | `false` | When `true`, adds movies to Radarr in an unmonitored state |
| `RADARR_TAGS` | - | Additional tags to apply to movies (comma-separated). Movies are always tagged with `letterboxd` |
| `LETTERBOXD_TAKE_AMOUNT` | - | Number of movies to sync (requires `LETTERBOXD_TAKE_STRATEGY`) |
| `LETTERBOXD_TAKE_STRATEGY` | - | Movie selection strategy: `newest` or `oldest` (requires `LETTERBOXD_TAKE_AMOUNT`) |
| `DRY_RUN` | `false` | When `true`, logs what would be added to Radarr without making actual API calls |
| `DATA_DIR` | `/data` | Directory for storing application data. You generally do not need to worry about this. |

## Development

### Prerequisites

- Node.js 20+
- Yarn package manager

### Setup

```bash
# Clone the repository
git clone https://github.com/Blu777/lettarboxd.git
cd lettarboxd

# Install dependencies
yarn install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Run in development mode
yarn start:dev
```

### Development Commands

```bash
yarn start:dev    # Run with auto-reload
yarn tsc          # Compile TypeScript
yarn tsc --noEmit # Type check only
```

### Development Mode

When `NODE_ENV=development`, the application:
- Only processes the first 5 movies (for faster testing)
- Uses more verbose logging
- Includes additional debug information

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Common Issues

**Movies not being added**
- Verify your Radarr API key and URL are correct
- Check that the quality profile name matches exactly (case-sensitive)
- Ensure your Letterboxd list is public

**Docker container won't start**
- Verify all required environment variables are set
- Check container logs: `docker logs lettarboxd`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Legal Disclaimer

This project is intended for use with legally sourced media only. It is designed to help users organize and manage their personal media collections. The developers of Lettarboxd do not condone or support piracy in any form. Users are solely responsible for ensuring their use of this software complies with all applicable laws and regulations in their jurisdiction.
