export type UrlSourceType =
  | 'twitter_post'
  | 'instagram_post'
  | 'youtube_video'
  | 'reddit_post'
  | 'linkedin_post'
  | 'article'
  | 'web_page';

export function detectUrlType(url: string): UrlSourceType {
  try {
    const hostname = new URL(url).hostname;

    if (hostname.includes('twitter.com') || hostname.includes('x.com'))
      return 'twitter_post';
    if (hostname.includes('instagram.com'))
      return 'instagram_post';
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be'))
      return 'youtube_video';
    if (hostname.includes('reddit.com'))
      return 'reddit_post';
    if (hostname.includes('linkedin.com'))
      return 'linkedin_post';
    if (hostname.includes('medium.com') || hostname.includes('substack.com'))
      return 'article';

    return 'web_page';
  } catch {
    return 'web_page';
  }
}

export function urlTypeLabel(type: UrlSourceType): string {
  switch (type) {
    case 'twitter_post': return 'Tweet / X Post';
    case 'instagram_post': return 'Instagram Post';
    case 'youtube_video': return 'YouTube Video';
    case 'reddit_post': return 'Reddit Post';
    case 'linkedin_post': return 'LinkedIn Post';
    case 'article': return 'Article';
    case 'web_page': return 'Web Page';
  }
}

export function urlTypeEmoji(type: UrlSourceType): string {
  switch (type) {
    case 'twitter_post': return '🐦';
    case 'instagram_post': return '📸';
    case 'youtube_video': return '🎬';
    case 'reddit_post': return '🤖';
    case 'linkedin_post': return '💼';
    case 'article': return '📰';
    case 'web_page': return '🌐';
  }
}
