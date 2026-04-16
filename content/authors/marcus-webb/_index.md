---
title: "Marcus Webb"
role: "Financial Markets & Earnings Analyst"
---

{{ define "main" }}
<div class="author-page">
  <div class="author-header">
    <div class="author-avatar">M</div>
    <div class="author-info">
      <h1>Marcus Webb</h1>
      <div class="author-role">Financial Markets & Earnings Analyst</div>
      <p class="author-bio">Marcus Webb is MenshlyGlobal's Financial Markets and Earnings Analyst, dissecting quarterly earnings calls, stock performance, and investment strategy. His analysis helps investors navigate complex financial landscapes with data-driven insights.</p>
    </div>
  </div>
  <div class="section-header">
    <h2>Articles by Marcus Webb</h2>
  </div>
  <div class="posts">
    {{ $posts := where .Site.RegularPages "Section" "posts" }}
    {{ $authorPosts := where $posts "Params.author" "Marcus Webb" }}
    {{ if gt (len $authorPosts) 0 }}
      {{ range $authorPosts }}
      <a class="post-card" href="{{ .Permalink }}">
        {{ with .Params.image }}<img src="{{ . }}" alt="{{ .Title }}" loading="lazy">{{ end }}
        {{ with .Params.categories }}{{ $cat := index . 0 }}<span class="meta">{{ $cat }} &middot; {{ .Date.Format "Jan 2, 2006" }}</span>{{ end }}
        <h2>{{ .Title }}</h2>
      </a>
      {{ end }}
    {{ else }}
      <p style="color:var(--text-muted);">No articles found.</p>
    {{ end }}
  </div>
</div>
{{ end }}
