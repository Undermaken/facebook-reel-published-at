// Reduced, credential-free structures from the supplied GraphQL envelopes.
export function story(
  videoId = '5532624203628819',
  publishTime = 1792070163,
  aiGenerated?: boolean,
) {
  return {
    __typename: 'Story',
    ...(aiGenerated === undefined
      ? {}
      : {
          ai_generated_detected_info: {
            was_detected_as_ai_generated: aiGenerated,
            gen_ai_transparency_type: 'NONE',
          },
        }),
    tracking: JSON.stringify({
      page_insights: {
        '10001': { post_context: { publish_time: publishTime, object_fbtype: 266 } },
        '20002': { page_context: {} },
      },
    }),
    attachments: [
      {
        media: {
          __typename: 'Video',
          id: videoId,
          shareable_url: `https://www.facebook.com/reel/${videoId}`,
          owner: { id: '10001' },
        },
      },
    ],
  };
}

export const streamedResponse = [
  { data: { viewer: { video_feed_unit_feed: { edges: [] } } } },
  {
    label: 'FBUnifiedVideoContainer_reels$stream$feed',
    path: ['viewer', 'video_feed_unit_feed', 'edges', 0],
    data: { node: story() },
  },
  {
    label: 'FBUnifiedVideoContainer_reels$stream$feed',
    path: ['viewer', 'video_feed_unit_feed', 'edges', 1],
    data: { node: story('3720001698147023', 1792357922) },
  },
  {
    label: 'FBUnifiedVideoMediaFooter$defer$footer',
    path: ['viewer', 'video_feed_unit_feed', 'edges', 0, 'node'],
    data: { ...story(), creation_time: 1 },
  },
]
  .map((part) => JSON.stringify(part))
  .join('\n   \n');
