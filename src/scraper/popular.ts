import * as cheerio from 'cheerio';
import Bluebird from 'bluebird';
import { LetterboxdMovie, LETTERBOXD_BASE_URL } from ".";
import { getMovie } from './movie';
import logger from '../util/logger';
import Scraper from './scraper.interface';

export class PopularScraper implements Scraper {
    constructor(private url: string, private take?: number, private strategy?: 'oldest' | 'newest') {}

    async getMovies(): Promise<LetterboxdMovie[]> {
        let urlToTransform = this.url;

        if (this.strategy === 'oldest') {
            urlToTransform = this.url.replace(/\/$/, '') + '/by/release-date-earliest/';
        }

        // Transform URL to AJAX endpoint
        // /films/popular/ -> /films/ajax/popular/
        const ajaxUrl = this.transformToAjaxUrl(urlToTransform);

        const allMovieLinks = await this.getAllMovieLinks(ajaxUrl);
        const linksToProcess = typeof this.take === 'number' ? allMovieLinks.slice(0, this.take) : allMovieLinks;

        const results = await Bluebird.map(linksToProcess, async (link): Promise<LetterboxdMovie | null> => {
            try {
                return await getMovie(link);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                logger.warn(`Skipping movie "${link}" due to scrape error: ${message}`);
                return null;
            }
        }, {
            concurrency: 10
        });

        const movies = results.filter((m): m is LetterboxdMovie => m !== null);

        if (movies.length < linksToProcess.length) {
            logger.warn(`Skipped ${linksToProcess.length - movies.length} of ${linksToProcess.length} movies due to scrape errors.`);
        }

        return movies;
    }

    private transformToAjaxUrl(url: string): string {
        // Remove trailing slash for easier manipulation
        const cleanUrl = url.replace(/\/$/, '');

        // Transform /films/popular... to /films/ajax/popular...
        // Handles both /films/popular and /films/popular/by/release-date-earliest
        if (cleanUrl.startsWith('https://letterboxd.com/films/popular')) {
            const suffix = cleanUrl.replace('https://letterboxd.com/films/popular', '');
            return 'https://letterboxd.com/films/ajax/popular' + suffix + '/';
        }

        // If already an AJAX URL, return as is
        if (cleanUrl.includes('/films/ajax/popular')) {
            return cleanUrl + '/';
        }

        throw new Error(`Unsupported popular movies URL format: ${url}`);
    }

    private async getAllMovieLinks(baseUrl: string): Promise<string[]> {
        let currentUrl: string | null = baseUrl;
        const allLinks: string[] = [];

        while (currentUrl) {
            logger.debug(`Fetching popular movies page: ${currentUrl}`);

            const response = await fetch(currentUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch popular movies page: ${response.status}`);
            }

            const html = await response.text();
            const pageLinks = this.getMovieLinksFromHtml(html);
            allLinks.push(...pageLinks);

            currentUrl = this.getNextPageUrl(html);

            if (currentUrl) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        logger.debug(`Retrieved ${allLinks.length} links from popular movies.`);

        return allLinks;
    }

    private getMovieLinksFromHtml(html: string): string[] {
        const $ = cheerio.load(html);
        const links: string[] = [];

        $('.react-component[data-target-link]').each((_, element) => {
            const filmLink = $(element).attr('data-target-link');
            if (filmLink) {
                links.push(filmLink);
            }
        });
        logger.debug(`Found ${links.length} links.`);
        return links;
    }

    private getNextPageUrl(html: string): string | null {
        const $ = cheerio.load(html);
        const nextLink = $('.paginate-nextprev .next').attr('href');

        if (nextLink) {
            return new URL(nextLink, LETTERBOXD_BASE_URL).toString();
        }

        return null;
    }
}
