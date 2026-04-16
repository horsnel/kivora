---
title: "Amara Okonkwo"
role: "West Africa Correspondent"
---

{{ define "main" }}
<div class="author-page">
  <div class="author-header">
    <div class="author-avatar">A</div>
    <div class="author-info">
      <h1>Amara Okonkwo</h1>
      <div class="author-role">West Africa Correspondent</div>
      <p class="author-bio">Amara Okonkwo is MenshlyGlobal's West Africa Correspondent, specializing in political developments, digital policy, and socio-economic trends across the African continent. Based in Lagos, she brings firsthand insights into emerging markets and regulatory shifts that shape the region's future.</p>
    </div>
  </div>
  <div class="section-header">
    <h2>Articles by Amara Okonkwo</h2>
  </div>
  <div class="posts">
    {{ $posts := where .Site.RegularPages "Section" "posts" }}
    {{ $authorPosts := where $posts "Params.author" "Amara Okonkwo" }}
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
