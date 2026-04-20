<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom" xmlns="http://www.w3.org/1999/xhtml">
  <xsl:output method="html" encoding="UTF-8" indent="yes" doctype-system="about:legacy-compat"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title><xsl:value-of select="/rss/channel/title"/> — RSS Feed</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f2ed;
            color: #2c3e50;
            line-height: 1.6;
          }
          .header {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #fff;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            font-size: 1.8rem;
            font-weight: 300;
            margin-bottom: 8px;
          }
          .header h1 strong { font-weight: 700; }
          .header .subtitle {
            font-size: 0.95rem;
            opacity: 0.8;
            margin-bottom: 20px;
          }
          .header .badge {
            display: inline-block;
            background: #e74c3c;
            color: #fff;
            font-size: 0.7rem;
            font-weight: 700;
            padding: 4px 12px;
            border-radius: 20px;
            letter-spacing: 1px;
            text-transform: uppercase;
          }
          .header .info {
            margin-top: 16px;
            font-size: 0.82rem;
            opacity: 0.6;
          }
          .container { max-width: 720px; margin: 0 auto; padding: 24px 20px; }
          .item {
            background: #fff;
            border-radius: 10px;
            padding: 20px 24px;
            margin-bottom: 12px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.06);
            transition: box-shadow 0.2s;
          }
          .item:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .item a {
            text-decoration: none;
            color: #2c3e50;
            font-weight: 600;
            font-size: 1.05rem;
            line-height: 1.4;
          }
          .item a:hover { color: #c0392b; }
          .item .meta {
            font-size: 0.75rem;
            color: #999;
            margin-top: 6px;
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }
          .item .meta span { display: inline-flex; align-items: center; gap: 4px; }
          .item .desc {
            margin-top: 10px;
            font-size: 0.88rem;
            color: #666;
            line-height: 1.6;
          }
          .footer {
            text-align: center;
            padding: 32px 20px;
            font-size: 0.8rem;
            color: #999;
          }
          .footer a { color: #c0392b; text-decoration: none; }
          .footer a:hover { text-decoration: underline; }
          .rss-icon { display: inline-block; vertical-align: middle; margin-right: 4px; }
          @media (max-width: 600px) {
            .header h1 { font-size: 1.4rem; }
            .item { padding: 16px; }
            .item a { font-size: 0.95rem; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1><strong><xsl:value-of select="/rss/channel/title"/></strong></h1>
          <div class="subtitle"><xsl:value-of select="/rss/channel/description"/></div>
          <div class="badge">RSS Feed</div>
          <div class="info">
            Subscribe with your RSS reader or paste this URL into any feed app
          </div>
        </div>
        <div class="container">
          <xsl:for-each select="/rss/channel/item">
            <div class="item">
              <a href="{link}">
                <xsl:value-of select="title"/>
              </a>
              <div class="meta">
                <span>
                  <xsl:choose>
                    <xsl:when test="pubDate">
                      <xsl:value-of select="substring(pubDate, 1, 16)"/>
                    </xsl:when>
                    <xsl:otherwise>
                      <xsl:value-of select="substring(/rss/channel/lastBuildDate, 1, 16)"/>
                    </xsl:otherwise>
                  </xsl:choose>
                </span>
              </div>
              <div class="desc">
                <xsl:value-of select="description" disable-output-escaping="yes"/>
              </div>
            </div>
          </xsl:for-each>
        </div>
        <div class="footer">
          <p>Powered by <a href="{/rss/channel/link}"><xsl:value-of select="/rss/channel/title"/></a> — Built with Hugo</p>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
