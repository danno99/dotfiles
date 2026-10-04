# Deploy chezmoi
sudo pacman -S chezmoi

# Download, initialize, and apply everything in one single command
chezmoi init --apply danno99

# Fix GTK apps
gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'
