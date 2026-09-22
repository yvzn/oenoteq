// Package static embeds the built Vue SPA into the Go binary and serves it,
// falling back to index.html for unknown paths so client-side routing works.
package static

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
)

//go:embed dist
var distFS embed.FS

func Handler() (http.Handler, error) {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		return nil, err
	}

	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleaned := path.Clean(r.URL.Path)[1:]
		if cleaned == "" {
			cleaned = "."
		}
		if _, err := fs.Stat(sub, cleaned); err != nil {
			r = r.Clone(r.Context())
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	}), nil
}
