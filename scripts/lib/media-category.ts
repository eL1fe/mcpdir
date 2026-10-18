// Media keywords are matched on word boundaries: substring matching would put
// words like "intermediate" into Media.
const MEDIA_TERMS = [
  "video",
  "videos",
  "audio",
  "music",
  "songs?",
  "spotify",
  "youtube",
  "podcasts?",
  "ffmpeg",
  "twitch",
  "vimeo",
  "films?",
  "movies?",
  "footage",
  "photos?",
  "photography",
  "soundcloud",
  "multimedia",
  // Bare "media" mostly means social media posts or upload fields, so only phrases count
  "media[\\s-](?:players?|servers?|library|libraries|generation|processing)",
  "plex",
  "jellyfin",
  "imagemagick",
  "elevenlabs",
  "midjourney",
  "stable[\\s-]diffusion",
  "dall[\\s-]?e",
  "text[\\s-]to[\\s-](?:speech|image|video)",
  "speech[\\s-]to[\\s-]text",
  "image[\\s-]to[\\s-]video",
  "tts",
  "transcription",
  "subtitles?",
  "image[\\s-](?:generation|editing)",
  "voice[\\s-]cloning",
];

export const MEDIA_KEYWORD_PATTERN = new RegExp(`\\b(?:${MEDIA_TERMS.join("|")})\\b`, "i");

export function matchMediaKeyword(text: string): string | null {
  const match = MEDIA_KEYWORD_PATTERN.exec(text);
  return match ? match[0].toLowerCase() : null;
}
