# Localized explainer videos

The five `demo-*.mp4` files are silent 17-second H.264 videos at 1280×720. Each one uses the matching localized store screenshots and has its three explanatory captions burned into the picture. The corresponding `.srt` file is included so the wording can be changed without editing the video by hand.

The Reel scenes are labeled illustrations. They are suitable as a visual explanation of the extension's behavior, while a recording of a real Reel with the date badge would better show the live experience. The Chrome Web Store asks for a YouTube video URL in each localized listing; it does not ingest the MP4 directly.

Regenerate the videos after changing screenshots or captions with `node store/scripts/render-video.mjs`.
