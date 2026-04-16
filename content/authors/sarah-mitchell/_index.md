---
title: "Sarah Mitchell"
role: "Technology & Innovation Editor"
---

{{ define "main" }}
<div class="author-page">
  <div class="author-header">
    <div class="author-avatar">S</div>
    <div class="author-info">
      <h1>Sarah Mitchell</h1>
      <div class="author-role">Technology & Innovation Editor</div>
      <p class="author-bio">Sarah Mitchell is the Technology and Innovation Editor at MenshlyGlobal, covering AI developments, platform economics, and luxury tech. Her reporting bridges the gap between consumer technology trends and their broader economic implications.</p>
    </div>
  </div>
  <div class="section-header">
    <h2>Articles by Sarah Mitchell</h2>
  </div>
  <div class="posts">
    {{ $posts := where .Site.RegularPages "Section" "posts" }}
    {{ $authorPosts := where $posts "Params.author" "Sarah Mitchell" }}
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
