# YouTube API Compliance Review Screencast Script

Application: CreatorOps Influencer Suite  
Production URL: https://creatorops-influencer-suite.onrender.com  
Privacy Policy URL: https://creatorops-influencer-suite.onrender.com/privacy  
Terms of Service URL: https://creatorops-influencer-suite.onrender.com/terms  
Recommended video length: As long as needed to clearly show the requested workflows  
Recording language: English  

## Recording Notes

- Do not show the full YouTube API key on screen. If an API key field is visible, keep it masked or blurred.
- Use the production URL, not localhost.
- Show that YouTube data is used only for public creator discovery, public video/reference analysis, and campaign reporting.
- Clearly state that the application does not request private YouTube user data and does not upload, modify, or delete YouTube content.
- Show the Privacy Policy and Terms links during the recording.

## Scene 1. Introduction

Show: Production website home/app screen.

Narration:

Hello, this screencast explains how CreatorOps Influencer Suite uses YouTube API Services in the production client location and why additional quota is needed.

The application URL is https://creatorops-influencer-suite.onrender.com.

CreatorOps helps marketing teams discover public creators, evaluate creator fit for brand campaigns, manage outreach candidates, track published campaign content, and generate performance reports.

We use YouTube API Services only to access publicly available YouTube channel and video metadata. We do not use the YouTube API to access private user data, upload videos, modify channels, delete content, or perform actions on behalf of a YouTube user.

## Scene 2. Compliance Links

Show: Open the Privacy Policy and Terms of Service links.

Narration:

The application provides public Privacy Policy and Terms of Service pages.

Our Privacy Policy explains that YouTube API Services are used for public YouTube channel and video data, including creator discovery, content reference search, and campaign performance reporting.

Our Terms of Service also includes YouTube API Services and links users to the YouTube Terms of Service and Google Privacy Policy.

## Scene 3. Campaign Context

Show: Open the Campaign page and select or open a campaign.

Narration:

CreatorOps is campaign-based. A user first creates or selects a brand campaign. The campaign includes brand, product, target audience, keywords, influencer conditions, schedule, and KPI goals.

The YouTube data is not collected randomly. It is used in the context of a campaign brief so that the user can find relevant creators or track campaign content.

Additional quota is needed because one campaign can require many public keyword searches, channel validations, video reference checks, and repeated campaign performance refreshes.

## Scene 4. Creator Discovery With YouTube Public Data

Show: Open Discovery, choose YouTube, country, category, and keyword. Click the real web discovery button if safe to demonstrate.

Narration:

In the Discovery page, users can search for creators by campaign keyword, platform, country, and category.

When the user selects YouTube, CreatorOps calls YouTube Data API endpoints such as search.list and channels.list to find public YouTube channels and read public metadata such as channel title, channel URL, subscriber count, thumbnail, and related public statistics where available.

This data is shown to the user as discovery candidates. The user can review the public channel link, data quality status, platform, country, follower or subscriber count, average view estimate, and matching score.

The discovery step is quota-heavy because one useful candidate list may require multiple keyword searches, channel checks, and duplicate filtering. CreatorOps saves results so the same public data does not need to be fetched repeatedly.

## Scene 5. Candidate Pool And Outreach Preparation

Show: Select a few YouTube candidates and save them to the pre-message candidate pool or candidate group.

Narration:

After discovery, the user can save selected creators into a candidate pool or reusable candidate group.

CreatorOps does not automatically contact YouTube users through the YouTube API. Outreach is managed separately through email or manual outreach workflows when a public contact address is available.

The YouTube API is only used for public discovery and evaluation data, not for sending messages.

## Scene 6. Content Reference Search

Show: Open the Reference page, search a keyword, and show YouTube video references.

Narration:

The Reference page helps users find high-performing public content examples.

For YouTube, CreatorOps uses public video search and video metadata to retrieve public video titles, thumbnails, view counts, likes, comments, channel information, and public video URLs where available.

The purpose is to help marketers understand content patterns and create campaign briefs. The application does not copy videos or download YouTube content. It only stores public metadata and links as references.

Quota is needed here because marketers compare several keywords and regions to understand what public content is working.

## Scene 7. Campaign Content Tracking And Reporting

Show: Open Reports or Content Tracking. Add or show a YouTube video URL and metrics.

Narration:

When a campaign creator publishes a YouTube video, the user can register the public upload URL in the reporting area.

CreatorOps then uses YouTube video metadata to refresh public performance metrics such as views, likes, and comments where available.

These metrics are used to calculate campaign reporting values such as total views, average engagement rate, content performance, and daily change where the data source is available.

Reporting also creates repeated public metadata checks over time. A campaign may track many creator videos daily during the campaign period.

If a metric is not available from the source, the application marks it as pending, partially supported, or requiring verification. It does not present unsupported values as confirmed data.

## Scene 8. Data Use, Storage, And User Control

Show: Stay on the application reporting or settings screen if available.

Narration:

The application stores public metadata only for business campaign operations. Examples include public channel URL, public video URL, public title, thumbnail URL, public subscriber count where available, view count, like count, comment count, and collection timestamp.

CreatorOps does not store private YouTube account data from end users. We also do not use OAuth scopes for private YouTube account access in this workflow.

If users need to remove stored campaign data or public reference data from their workspace, they can delete saved candidates, remove references, or request data deletion through the contact listed in the Privacy Policy.

## Scene 9. Quota Usage Explanation

Show: Discovery and reporting pages again.

Narration:

The quota increase is requested because creator discovery and reporting require multiple public API calls across campaigns.

Typical usage includes YouTube creator discovery by keyword, channel metadata checks, public video reference searches, and scheduled public campaign content metric refreshes.

The application is designed for internal marketing operations and client reporting. It avoids unnecessary calls by saving results and reusing stored public metadata where appropriate. The quota increase is needed so campaign teams can work at normal operating volume without exhausting the default quota during legitimate public-data workflows.

## Scene 10. Closing

Show: Application dashboard or reporting screen.

Narration:

To summarize, CreatorOps uses YouTube API Services only for public creator discovery, public video reference search, and campaign performance reporting.

We do not access private YouTube user data. We do not upload, modify, or delete YouTube content. We do not send messages through YouTube API Services.

Additional quota lets CreatorOps support campaign-scale public discovery and reporting while keeping API usage limited to public YouTube metadata.

Thank you for reviewing our YouTube API Services compliance materials.

## Recommended Reply Email

Subject: Re: YouTube API Services Compliance Review - Screencast Provided

Hello YouTube API Services Team,

Thank you for your review.

We have prepared the requested English screencast showing how CreatorOps Influencer Suite uses YouTube API Services in the API client location.

The screencast demonstrates:

- the production application location,
- Privacy Policy and Terms of Service links,
- campaign-based creator discovery,
- YouTube public channel metadata usage,
- YouTube public video/reference metadata usage,
- campaign content tracking and reporting,
- why additional quota is needed for public creator discovery, public reference research, and scheduled public campaign metric refreshes,
- and our confirmation that we do not access private YouTube user data, upload/modify/delete YouTube content, or send messages through YouTube API Services.

Application URL: https://creatorops-influencer-suite.onrender.com  
Privacy Policy URL: https://creatorops-influencer-suite.onrender.com/privacy  
Terms of Service URL: https://creatorops-influencer-suite.onrender.com/terms  

Please let us know if any additional information is required.

Thank you,  
Mipingplan / CreatorOps Team
