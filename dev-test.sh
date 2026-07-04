#!/bin/bash
cd /home/z/my-project/kivora
export NEXT_PUBLIC_SUPABASE_URL=https://asfzdbpfakwpiawhhrby.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZnpkYnBmYWt3cGlhd2hocmJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1MDQwMzMsImV4cCI6MjA1ODA4MDAzM30.fake
export PORT=3456
./node_modules/.bin/next dev --port 3456 2>&1 &
sleep 15
curl -s http://localhost:3456 2>&1 | head -100
echo "---CHECKING FOR HYDRATION ERROR---"
# Kill the dev server
kill %1 2>/dev/null
