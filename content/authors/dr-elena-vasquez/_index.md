---
title: "Dr. Elena Vasquez"
role: "Science & Space Correspondent"
---

{{ define "main" }}
<div class="author-page">
  <div class="author-header">
    <div class="author-avatar">D</div>
    <div class="author-info">
      <h1>Dr. Elena Vasquez</h1>
      <div class="author-role">Science & Space Correspondent</div>
      <p class="author-bio">Dr. Elena Vasquez is MenshlyGlobal's Science and Space Correspondent, covering breakthrough discoveries in biotechnology, space exploration, and paleontology. She holds a PhD in Molecular Biology and translates complex scientific developments into accessible intelligence reports.</p>
    </div>
  </div>
  <div class="section-header">
    <h2>Articles by Dr. Elena Vasquez</h2>
  </div>
  <div class="posts">
    {{ $posts := where .Site.RegularPages "Section" "posts" }}
    {{ $authorPosts := where $posts "Params.author" "Dr. Elena Vasquez" }}
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
