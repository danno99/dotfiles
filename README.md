# Deploy browser
sudo pacman -S helium-browser-bin

# Deploy chezmoi
sudo pacman -S chezmoi

# Authenticate with GitHub (needed if your repo is private)
gh auth login

# Download, initialize, and apply everything in one single command
chezmoi init --apply git@github.com:$GITHUB_USERNAME/dotfiles.git

# Fix GTK apps
gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'
