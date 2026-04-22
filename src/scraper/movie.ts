import * as cheerio from 'cheerio';
import { LETTERBOXD_BASE_URL, LetterboxdMovie } from ".";
import logger from '../util/logger';

/**
 * Obtain details of a movie.
 * @param link - This is the 'data-film-link' property on the movie div in letterboxd.
 */
export async function getMovie(link: string): Promise<LetterboxdMovie> {
    const movieUrl = new URL(link, LETTERBOXD_BASE_URL).toString();
    
    const response = await fetch(movieUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch movie page: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    return extractMovieFromHtml(link, html);
}

function extractMovieFromHtml(slug: string, html: string): LetterboxdMovie {
    const $ = cheerio.load(html);
    
    const name = extractName($);
    const tmdbId = extractTmdbId($);
    const imdbId = extractImdbId($);
    const id = extractLetterboxdId($);
    const year = extractPublishedYear($);
    
    const letterboxdResult = {
        id,
        name,
        imdbId,
        tmdbId,
        publishedYear: year,
        slug
    };

    return letterboxdResult;
}

function extractName($: cheerio.CheerioAPI): string {
    const name = $('.primaryname').first().text().trim();
    return name;
}

function extractTmdbId($: cheerio.CheerioAPI): string|null {
    const tmdbLink = $('a[data-track-action="TMDB"]').attr('href');
    if (!tmdbLink) {
        logger.debug('Could not find TMDB link. This could happen if there is a TV show in the list.');
        return null;
    }
    
    const tmdbMatch = tmdbLink.match(/\/movie\/(\d+)/);
    if (!tmdbMatch) {
        logger.debug('Could not extract TMDB ID from link. This could happen because there is a TV show in the list.');
        return null;
    }
    
    return tmdbMatch[1];
}

function extractImdbId($: cheerio.CheerioAPI): string|null {
    const imdbLink = $('a[href*="imdb.com"]').attr('href');
    if (!imdbLink) {
        logger.debug('Could not find IMDB link. This could happen if there is a TV show in the list or the movie lacks IMDB data.');
        return null;
    }
    
    const imdbMatch = imdbLink.match(/\/title\/(tt\d+)/);
    if (!imdbMatch) {
        logger.debug('Could not extract IMDB ID from link. This could happen because of an unexpected IMDB URL format.');
        return null;
    }
    
    return imdbMatch[1];
}

function extractLetterboxdId($: cheerio.CheerioAPI): number {
    // Strategy 1 (legacy): explicit data-film-id attribute.
    // Kept first for backwards compatibility with older/cached pages.
    const legacyId = $('.film-poster img').closest('[data-film-id]').attr('data-film-id');
    if (legacyId && /^\d+$/.test(legacyId)) {
        return parseInt(legacyId, 10);
    }

    // Strategy 2: current markup exposes a JSON payload in data-postered-identifier,
    // e.g. data-postered-identifier='{"uid":"film:70007", ...}'.
    // See https://github.com/ryanpag3/lettarrboxd/issues/42
    const posteredRaw = $('[data-postered-identifier]').first().attr('data-postered-identifier');
    if (posteredRaw) {
        const idFromJson = parseFilmUidFromJson(posteredRaw);
        if (idFromJson !== null) return idFromJson;

        // Some pages may embed just "film:XXXXX" without full JSON; try regex fallback.
        const direct = posteredRaw.match(/film:(\d+)/);
        if (direct) return parseInt(direct[1], 10);
    }

    // Strategy 3: inline script setting window.__BXD_DATA with viewingable.uid = "film:XXXXX".
    const scripts = $('script').toArray();
    for (const el of scripts) {
        const content = $(el).html();
        if (!content) continue;
        const match = content.match(/viewingable[^}]*?uid["'\s:]+["']film:(\d+)["']/);
        if (match) return parseInt(match[1], 10);
    }

    throw new Error('Could not find Letterboxd film ID');
}

function parseFilmUidFromJson(raw: string): number | null {
    try {
        const parsed = JSON.parse(raw);
        const uid: unknown = parsed?.uid;
        if (typeof uid === 'string') {
            const m = uid.match(/^film:(\d+)$/);
            if (m) return parseInt(m[1], 10);
        }
    } catch {
        // Not JSON; callers will try other strategies.
    }
    return null;
}

function extractPublishedYear($: cheerio.CheerioAPI): number|null {
    const releaseDateLink = $('span.releasedate a').attr('href');
    if (releaseDateLink) {
        const yearMatch = releaseDateLink.match(/\/(\d{4})\//);
        if (yearMatch) {
            return parseInt(yearMatch[1], 10);
        }
    }
    
    logger.debug('Could not extract published year. This could happen if the release date format is unexpected or missing.');
    return null;
}