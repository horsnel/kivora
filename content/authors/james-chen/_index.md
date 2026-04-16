---
title: "James Chen"
role: "Senior Geopolitical Analyst"
---

{{ define "main" }}
<div class="author-page">
  <div class="author-header">
    <div class="author-avatar">J</div>
    <div class="author-info">
      <h1>James Chen</h1>
      <div class="author-role">Senior Geopolitical Analyst</div>
      <p class="author-bio">James Chen serves as MenshlyGlobal's Senior Geopolitical Analyst, covering US foreign policy, trade sanctions, and global energy markets. With over a decade of experience in international relations and financial markets, James provides readers with deep strategic analysis of geopolitical risk.</p>
    </div>
  </div>
  <div class="section-header">
    <h2>Articles by James Chen</h2>
  </div>
  <div class="posts">
    {{ $posts := where .Site.RegularPages "Section" "posts" }}
    {{ $authorPosts := where $posts "Params.author" "James Chen" }}
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
