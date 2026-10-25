import { Platform } from '../types/profile';

export type UrlType = 'PROFILE' | 'POST' | 'UNKNOWN';

export interface NormalizedUrlResult {
  originalUrl: string;
  normalizedUrl: string;
  platform: Platform;
  urlType: UrlType;
  canonicalKey: string;
  error?: string;
  isAmbiguous?: boolean;
}

/**
 * Strips wrapping punctuation, markdown syntax, quotes, and brackets often found in chat pastes.
 */
export function cleanRawUrlString(raw: string): string {
  if (!raw) return '';
  let str = raw.trim();
  
  // Remove wrapping markdown or punctuation like <url>, (url), [url], "url", 'url'
  str = str.replace(/^[<(\["']+|[>)\]"']+$/g, '');
  // Remove trailing period, comma, colon, semicolon if not part of query
  str = str.replace(/[,;:.]+(\s|$)/g, '$1');
  str = str.replace(/[.,;:)]+$/, '');
  
  return str.trim();
}

/**
 * Normalizes URLs safely, classifies platform, and determines if it represents a profile or a post.
 */
export function normalizeUrl(rawUrl: string): NormalizedUrlResult {
  const cleaned = cleanRawUrlString(rawUrl);
  
  if (!cleaned) {
    return {
      originalUrl: rawUrl,
      normalizedUrl: '',
      platform: 'UNKNOWN',
      urlType: 'UNKNOWN',
      canonicalKey: '',
      error: 'Empty URL',
    };
  }

  // Prepend https:// if protocol is missing
  let workingUrl = cleaned;
  if (!/^https?:\/\//i.test(workingUrl)) {
    workingUrl = 'https://' + workingUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(workingUrl);
  } catch (err) {
    return {
      originalUrl: rawUrl,
      normalizedUrl: cleaned,
      platform: 'UNKNOWN',
      urlType: 'UNKNOWN',
      canonicalKey: cleaned.toLowerCase(),
      error: 'Invalid URL syntax',
    };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  let pathname = parsed.pathname.replace(/\/+$/, ''); // Strip trailing slashes
  if (!pathname) pathname = '/';

  let platform: Platform = 'OTHER';
  let urlType: UrlType = 'UNKNOWN';
  let canonicalKey = '';

  // 1. Instagram
  if (hostname.includes('instagram.com') || hostname === 'instagr.am') {
    platform = 'INSTAGRAM';
    // Match posts: /p/ID, /reel/ID, /tv/ID
    const postMatch = pathname.match(/^\/(?:p|reel|reels|tv|stories)\/([a-zA-Z0-9_\-]+)/i);
    if (postMatch) {
      urlType = 'POST';
      const postId = postMatch[1];
      parsed.pathname = `/p/${postId}/`;
      parsed.search = '';
      parsed.hash = '';
      canonicalKey = `ig_post_${postId}`;
    } else {
      // Profile: /username
      const profileMatch = pathname.match(/^\/([a-zA-Z0-9._]+)/i);
      const reserved = ['explore', 'reels', 'stories', 'direct', 'accounts', 'developer'];
      if (profileMatch && !reserved.includes(profileMatch[1].toLowerCase())) {
        urlType = 'PROFILE';
        const username = profileMatch[1].toLowerCase();
        parsed.pathname = `/${username}/`;
        parsed.search = '';
        parsed.hash = '';
        canonicalKey = `ig_profile_${username}`;
      } else {
        urlType = 'UNKNOWN';
      }
    }
  }
  // 2. Facebook
  else if (hostname.includes('facebook.com') || hostname === 'fb.com' || hostname === 'fb.watch') {
    platform = 'FACEBOOK';
    // Post patterns: /posts/ID, /reel/ID, /videos/ID, story.php?story_fbid=...
    if (
      pathname.includes('/posts/') ||
      pathname.includes('/videos/') ||
      pathname.includes('/reel/') ||
      pathname.includes('/photo.php') ||
      pathname.includes('/permalink/') ||
      pathname.includes('/story.php') ||
      parsed.searchParams.has('story_fbid')
    ) {
      urlType = 'POST';
      canonicalKey = `fb_post_${pathname}`;
    } else {
      const fbUser = pathname.match(/^\/([a-zA-Z0-9.]+)/i);
      if (fbUser && !['groups', 'pages', 'watch', 'share'].includes(fbUser[1].toLowerCase())) {
        urlType = 'PROFILE';
        parsed.pathname = `/${fbUser[1].toLowerCase()}/`;
        canonicalKey = `fb_profile_${fbUser[1].toLowerCase()}`;
      } else {
        urlType = 'UNKNOWN';
      }
    }
  }
  // 3. TikTok
  else if (hostname.includes('tiktok.com')) {
    platform = 'TIKTOK';
    // Match post: /@username/video/ID
    const tiktokPost = pathname.match(/^\/@?([a-zA-Z0-9_.-]+)\/video\/(\d+)/i);
    if (tiktokPost) {
      urlType = 'POST';
      parsed.pathname = `/@${tiktokPost[1]}/video/${tiktokPost[2]}`;
      parsed.search = '';
      canonicalKey = `tt_post_${tiktokPost[2]}`;
    } else {
      const tiktokUser = pathname.match(/^\/@?([a-zA-Z0-9_.-]+)/i);
      if (tiktokUser) {
        urlType = 'PROFILE';
        parsed.pathname = `/@${tiktokUser[1]}`;
        parsed.search = '';
        canonicalKey = `tt_profile_${tiktokUser[1].toLowerCase()}`;
      }
    }
  }
  // 4. YouTube
  else if (hostname.includes('youtube.com') || hostname === 'youtu.be') {
    platform = 'YOUTUBE';
    if (hostname === 'youtu.be') {
      const videoId = pathname.replace(/^\//, '');
      if (videoId) {
        urlType = 'POST';
        canonicalKey = `yt_video_${videoId}`;
      }
    } else if ((pathname.includes('/watch') && parsed.searchParams.has('v')) || pathname.startsWith('/live/')) {
      urlType = 'POST';
      canonicalKey = `yt_video_${parsed.searchParams.get('v')}`;
    } else if (pathname.includes('/shorts/')) {
      urlType = 'POST';
      const shortId = pathname.replace('/shorts/', '');
      canonicalKey = `yt_short_${shortId}`;
    } else if (pathname.startsWith('/@') || pathname.startsWith('/c/') || pathname.startsWith('/channel/') || pathname.startsWith('/user/')) {
      urlType = 'PROFILE';
      canonicalKey = `yt_profile_${pathname.toLowerCase()}`;
    }
  }
  // 5. X / Twitter
  else if (hostname.includes('twitter.com') || hostname === 'x.com') {
    platform = 'X';
    const tweetMatch = pathname.match(/^\/([a-zA-Z0-9_]+)\/status\/(\d+)/i);
    if (tweetMatch) {
      urlType = 'POST';
      parsed.pathname = `/${tweetMatch[1]}/status/${tweetMatch[2]}`;
      parsed.search = '';
      canonicalKey = `x_post_${tweetMatch[2]}`;
    } else {
      const userMatch = pathname.match(/^\/([a-zA-Z0-9_]+)/i);
      if (userMatch && !['home', 'explore', 'notifications', 'messages'].includes(userMatch[1].toLowerCase())) {
        urlType = 'PROFILE';
        parsed.pathname = `/${userMatch[1].toLowerCase()}`;
        parsed.search = '';
        canonicalKey = `x_profile_${userMatch[1].toLowerCase()}`;
      }
    }
  } else {
    platform = 'WEBSITE';
    urlType = pathname === '/' || pathname === '' ? 'PROFILE' : 'UNKNOWN';
    canonicalKey = `${hostname}${pathname}`;
  }

  // Remove tracking query parameters (utm_*, fbclid, igshid, etc.) while preserving functional identifiers
  const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'igshid', '_ga'];
  trackingParams.forEach((param) => parsed.searchParams.delete(param));

  const normalizedUrl = parsed.toString();
  if (!canonicalKey) canonicalKey = normalizedUrl.toLowerCase();

  return {
    originalUrl: rawUrl,
    normalizedUrl,
    platform,
    urlType,
    canonicalKey,
  };
}
