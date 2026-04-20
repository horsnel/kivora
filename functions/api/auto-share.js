/**
 * Auto-Share API — Cloudflare Pages Function
 * Automatically posts new articles to social media when triggered
 * POST /api/auto-share
 * 
 * Body: { title, url, platform, webhookUrl, webhookSecret }
 * 
 * Supports: Twitter/X, Discord (webhook), Slack (webhook), custom webhooks
 * For Twitter/X: Uses webhook URL to an external service (IFTTT, Zapier, n8n, etc.)
 * For Discord/Slack: Sends rich embed cards directly to webhook URLs
 */
export async function onRequestPost(context) {
  try {
    const { title, url, platform, webhookUrl, webhookSecret, excerpt, image, author, category } = await context.request.json();

    if (!title || !url || !platform) {
      return new Response(JSON.stringify({ success: false, error: 'title, url, and platform are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const siteUrl = 'https://menshly-global.pages.dev';
    const fullUrl = url.startsWith('http') ? url : siteUrl + url;
    const encodedTitle = encodeURIComponent(title);
    const encodedUrl = encodeURIComponent(fullUrl);

    let result = { success: false };

    switch (platform.toLowerCase()) {
      case 'twitter':
      case 'x': {
        // For Twitter/X, send to a webhook proxy (IFTTT, n8n, Zapier, etc.)
        if (!webhookUrl) {
          result.shareUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
          result.success = true;
          result.method = 'redirect';
        } else {
          const payload = {
            title,
            url: fullUrl,
            text: `${title} ${fullUrl}`,
            platform: 'twitter'
          };
          if (webhookSecret) payload.secret = webhookSecret;

          const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          result = await resp.json();
        }
        break;
      }

      case 'discord': {
        if (!webhookUrl) {
          result.error = 'Discord webhook URL is required';
          break;
        }
        const discordPayload = {
          username: 'MenshlyGlobal',
          avatar_url: `${siteUrl}/favicon.ico`,
          embeds: [{
            title: title.length > 256 ? title.substring(0, 253) + '...' : title,
            url: fullUrl,
            description: excerpt ? (excerpt.length > 350 ? excerpt.substring(0, 347) + '...' : excerpt) : '',
            color: 0xc0392b,
            footer: {
              text: author ? `By ${author}` : 'MenshlyGlobal Intelligence Board'
            },
            fields: category ? [{ name: 'Category', value: category, inline: true }] : [],
            image: image ? { url: image } : undefined,
            timestamp: new Date().toISOString()
          }]
        };

        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload)
        });
        const respText = await resp.text();
        result = { success: resp.status === 204, status: resp.status, response: respText };
        break;
      }

      case 'slack': {
        if (!webhookUrl) {
          result.error = 'Slack webhook URL is required';
          break;
        }
        const slackPayload = {
          text: `*${title}*\n${fullUrl}`,
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: title.length > 150 ? title.substring(0, 147) + '...' : title }
            },
            ...(category ? [{ type: 'context', elements: [{ type: 'mrkdwn', text: `*${category}*${author ? ` | By ${author}` : ''}` }] }] : []),
            ...(excerpt ? [{ type: 'section', text: { type: 'mrkdwn', text: excerpt.length > 300 ? excerpt.substring(0, 297) + '...' : excerpt } }] : []),
            {
              type: 'actions',
              elements: [{
                type: 'button',
                text: { type: 'plain_text', text: 'Read Full Article' },
                url: fullUrl,
                action_id: 'read_article'
              }]
            }
          ]
        };

        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload)
        });
        const respData = await resp.json();
        result = { success: respData.ok === true, response: respData };
        break;
      }

      case 'telegram': {
        if (!webhookUrl) {
          result.shareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
          result.success = true;
          result.method = 'redirect';
          break;
        }
        const tgPayload = {
          text: `*${title}*\n\n${excerpt ? excerpt.substring(0, 200) + '...\n\n' : ''}${fullUrl}`,
          parse_mode: 'Markdown',
          disable_web_page_preview: false
        };
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tgPayload)
        });
        const respData = await resp.json();
        result = { success: respData.ok === true, response: respData };
        break;
      }

      case 'webhook': {
        if (!webhookUrl) {
          result.error = 'Webhook URL is required';
          break;
        }
        const customPayload = {
          title,
          url: fullUrl,
          excerpt,
          image,
          author,
          category,
          publishedAt: new Date().toISOString(),
          source: 'MenshlyGlobal'
        };
        if (webhookSecret) customPayload.secret = webhookSecret;

        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customPayload)
        });
        const respText = await resp.text();
        result = { success: resp.status >= 200 && resp.status < 300, status: resp.status, response: respText };
        break;
      }

      default:
        result.error = `Unsupported platform: ${platform}. Supported: twitter, discord, slack, telegram, webhook`;
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
