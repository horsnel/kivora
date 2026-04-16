---
title: "David Kiprop"
role: "World Affairs & Diplomacy Reporter"
---

{{ define "main" }}
<div class="author-page">
  <div class="author-header">
    <div class="author-avatar">D</div>
    <div class="author-info">
      <h1>David Kiprop</h1>
      <div class="author-role">World Affairs & Diplomacy Reporter</div>
      <p class="author-bio">David Kiprop covers world affairs and diplomacy for MenshlyGlobal, with a focus on African politics, civil rights movements, and international religious diplomacy. His reporting provides context-sensitive analysis of global events through a multicultural lens.</p>
    </div>
  </div>
  <div class="section-header">
    <h2>Articles by David Kiprop</h2>
  </div>
  <div class="posts">
    {{ $posts := where .Site.RegularPages "Section" "posts" }}
    {{ $authorPosts := where $posts "Params.author" "David Kiprop" }}
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
