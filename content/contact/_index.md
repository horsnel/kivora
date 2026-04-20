---
title: "Contact Us"
description: "Get in touch with MenshlyGlobal"
---

{{ define "main" }}
<div class="static-page"><h1>Contact Us</h1><div class="static-content"><p>We value your feedback. Reach out to us.</p><form class="contact-form" onsubmit="event.preventDefault();alert('Thank you for your message!');"><label>Name <input type="text" required></label><label>Email <input type="email" required></label><label>Subject <input type="text" required></label><label>Message <textarea rows="5" required></textarea></label><button type="submit">Send Message</button></form></div></div>
{{ end }}