from livereload import Server

# Serve files from current directory
server = Server()
server.watch('.', delay=1)  # Watch all files in the current directory
server.serve(root='.', port=5500)