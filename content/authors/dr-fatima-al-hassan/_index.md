---
title: "Dr. Fatima Al Hassan"
role: "Health & Pharma Intelligence Analyst"
---

{{ define "main" }}
<div class="author-page">
  <div class="author-header">
    <div class="author-avatar">D</div>
    <div class="author-info">
      <h1>Dr. Fatima Al Hassan</h1>
      <div class="author-role">Health & Pharma Intelligence Analyst</div>
      <p class="author-bio">Dr. Fatima Al Hassan leads MenshlyGlobal's health and pharmaceutical intelligence coverage, analyzing clinical trials, drug development breakthroughs, and global health trends. Her expertise in public health provides readers with evidence-based insights into the healthcare industry.</p>
    </div>
  </div>
  <div class="section-header">
    <h2>Articles by Dr. Fatima Al Hassan</h2>
  </div>
  <div class="posts">
    {{ $posts := where .Site.RegularPages "Section" "posts" }}
    {{ $authorPosts := where $posts "Params.author" "Dr. Fatima Al Hassan" }}
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
