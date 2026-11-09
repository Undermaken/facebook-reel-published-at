# Metadata observed in the supplied response

This inventory comes from the supplied GraphQL attachment: 18 envelopes containing
four Reel stories. Examples are values in that capture, not current live counts.
Availability must be checked per Reel. Fields from deferred fragments still need
an explicit association with their own story/video before displaying them.

Some information may already appear in a Facebook menu or as an abbreviated count.
The supplied files do not establish that every account's viewer hides these fields.
The explicit AI indication is now available as an optional badge, disabled by
default. The other additional fields are not displayed by the extension.

In the paths below, `media` refers to the story's `attachments[].media`, including
the initial `data.node` story and later deferred `data` fragments.

| Information                            | Observed evidence                                                                                                                                                             | Interpretation and limits                                                                                                                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact video duration                   | `media.playable_duration_in_ms = 17589`; `media.length_in_second = 17.589`                                                                                                    | A duration of 17.589 seconds, useful when the viewer omits a time counter.                                                                                                                                     |
| Video dimensions and available quality | `media.width = 1080`, `media.height = 1920`; `extensions.all_video_dash_prefetch_representations[].representations[]` includes 720 × 1280 and 1080 × 1920 video streams       | Vertical 9:16 video, with HD and Full HD representations. This does not establish the original camera resolution or the quality currently being played. Prefetch entries must be matched to the correct video. |
| Subtitle language and source           | `media.video_available_captions_locales[]`: `locale = it_IT`, `localized_unambiguous_language = Italiano`, `localized_creation_method = Sottotitoli generati automaticamente` | Italian automatic subtitles are available for one sampled Reel; others have empty arrays. The actual subtitle text was not downloaded.                                                                         |
| Full reaction and comment counts       | `fb_reel_react_button.story.feedback.unified_reactors.count = 293402`; `feedback.total_comment_count = 4971`                                                                  | Precise snapshot counts can be clearer than abbreviated labels. These are not views or unique audience counts.                                                                                                 |
| Original-audio indication              | `media.is_original_audio_on_facebook = true`                                                                                                                                  | Facebook classifies the audio as original audio on its platform. This is not proof of authorship, ownership or licensing rights.                                                                               |
| Sharing status and audience            | `data.is_reshare = false`; `data.privacy_scope.display_label = Tutti`                                                                                                         | The story is not flagged as a reshare and has a public audience in these samples. A false reshare flag does not prove the clip has never been copied or reposted.                                              |
| AI transparency metadata               | `data.ai_generated_detected_info.was_detected_as_ai_generated = false`, `gen_ai_transparency_type = NONE`                                                                     | Potentially useful when a positive label is present. These samples have no positive AI indication; absence is not evidence that a video was made without AI.                                                   |

Lower-priority technical metadata includes audio availability, live/broadcast flags,
stream codecs and bitrates. `share_count_reduced` is a localized display string
(one sample is `16.327`), so it should not be treated as a guaranteed exact integer
across languages or larger abbreviated counts.

No usable view count, save count, watch time, reach or viewer list was found in this
response. `loop_count` is a playback setting and must not be presented as views.
Null sponsorship/originality fields do not establish that the content is
unsponsored or original. The extension should not invent missing metrics or make
extra authenticated requests just to fill these gaps.
