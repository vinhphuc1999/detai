/** Class representing the frontend */
module.exports = class View {
    /**
     * Create the frontend logic.
     * @param {Object} ipcRenderer 
     * @param {Object} Main 
     * @param {Object} Player 
     */
    constructor(ipcRenderer, Main, Player) {
        const self = this;

        self._musicMetadata = require('music-metadata');
        self._path = require('path');

        self._currentlyPlaying = undefined;
        self._list = self._getElem('songs');
        self._folderButton = self._getElem('open-folder');
        self._playButton = self._getElem('play');
        self._forward = self._getElem('next-song');
        self._backward = self._getElem('last-song');
        self._shuffle = self._getElem('shuffle');
        self._repeat = self._getElem('repeat');
        self._sortByName = self._getElem('by-name');
        self._sortByAlbum = self._getElem('by-album');
        self._sortByArtist = self._getElem('by-artist');
        self._search = self._getElem('search');
        self._creator = self._getElem('creator-link');
        self._volume = self._getElem('volume');
        self._timerEnd = self._getElem('timer-end');
        self._timerStart = self._getElem('timer-start');
        self._albumCover = self._getElem('album-img');
        self._songName = self._getElem('song-title');
        self._artist = self._getElem('song-artist');
        self._progress = self._getElem('progress-value');

        self._updateInterval = undefined;

        self._albumCoverImage = undefined;

        self._folderButton.addEventListener('click', () =>
            ipcRenderer.send('open-file-dialog')
        );

        ipcRenderer.on('music-files', (e, files) => {
            self.listFiles(files, true, Main, Player);
        });

        self._playButton.addEventListener('click', () => {
            Player.playPause(Main, self);
            self.togglePlayButton(Player);
        });

        self._forward.addEventListener('click', () => {
            Player.next(self, Main);
        });

        self._backward.addEventListener('click', () => {
            Player.previous(self, Main);
        });

        self._shuffle.addEventListener('click', () =>
            self._toggleShuffle(Main, Player)
        );

        self._repeat.addEventListener('click', () => self._toggleRepeat(Player));

        [self._sortByName, self._sortByAlbum, self._sortByArtist].forEach(btn => {
            btn.addEventListener('click', Main.sort.bind(Main));
        });

        self._search.addEventListener('keyup', self.search);

        self._creator.addEventListener('click', self.showWebsite);

        self._volume.addEventListener('input', () =>
            Player.setVolume(self._volume.value)
        );

        self._progress.addEventListener('click', e => {
            const percent = e.offsetX / self._progress.offsetWidth;
            self._progress.value = percent / 100;
            Player.setProgress(percent);
            self.updateUI(Main, Player);
        });
    }

    /**
     * Gets an element by its id.
     * @param {string} id 
     * @return {HTMLElement} HTMLElement
     */
    _getElem(id) {
        return document.getElementById(id);
    }

    /**
     * Filters playlist with user input.
     * @param {Event} e 
     */
    search(e) {
        const query = e.target.value;
        const list = document.querySelectorAll('div[data-file-path]');

        for (let i = 0; i < list.length; i++) {
            const name = list[i].firstChild.innerText.toLowerCase();
            if (query.trim() === '' || name.includes(query)) {
                list[i].style.display = 'grid';
            } else {
                list[i].style.display = 'none';
            }
        }
    }

    /**
     * Navigates to author website in systems default browser.
     */
    showWebsite() {
        require('electron').shell.openExternal('https://codef0x.dev');
    }

    /**
     * Lists all files from a directory.
     * @param {Array<string>} files 
     * @param {boolean} newFolder 
     * @param {Object} Main 
     * @param {Object} Player 
     */
    listFiles(files, newFolder, Main, Player) {
        const self = this;

        /**
         * Handles click on song.
         */
        function clickHandler() {
            if (Player.isShuffled) {
                Player.reshuffleOnClick(
                    Main,
                    self,
                    this.getAttribute('data-file-path')
                );
                return;
            }

            Player.play(this.getAttribute('data-file-path'), self, Main);
        }

        if (newFolder) {
            self.resetUI();
            Player.stop(self);
            Main.sortedBy = undefined;
            Main.files = files;
        }

        Main.files = files;
        const list = self._list;
        list.innerHTML = '';

        const fragment = document.createDocumentFragment();

        for (let i = 0; i < files.length; i++) {
            const container = document.createElement('div');
            container.setAttribute('data-file-path', files[i].path);

            container.addEventListener('click', clickHandler);

            container.classList.add('song-container');

            const name = document.createElement('div');
            name.classList.add('song-titles');
            const album = document.createElement('div');
            album.classList.add('song-albums');
            const artist = document.createElement('div');
            artist.classList.add('song-artists');

            if (newFolder) {
                self._musicMetadata.parseFile(files[i].path).then(
                    metadata => {
                        const songName = self._path.basename(files[i].path);
                        const common = metadata.common;

                        name.innerText = common.title ? common.title : songName;
                        album.innerText = common.album ? common.album : 'Unknown';
                        artist.innerText = common.artist ? common.artist : 'Unknown';
                    },
                    err => console.error(err)
                );
            } else {
                name.innerText = files[i].name;
                album.innerText = files[i].album;
                artist.innerText = files[i].artist;
            }

            [name, album, artist].forEach(part => container.appendChild(part));
            fragment.appendChild(container);
            list.appendChild(fragment);
        }

        if (self._currentlyPlaying) {
            const songs = [...document.querySelectorAll('div[data-file-path]')];
            self._currentlyPlaying = songs.find(song => {
                return (
                    song.firstChild.innerText ===
                    self._currentlyPlaying.firstChild.innerText
                );
            });
            self._currentlyPlaying.classList.add('song-container-active');
        }

        // Issue #135
        self._search.disabled = false;

        // Issue #144
        [self._sortByAlbum, self._sortByArtist, self._sortByName].forEach(
            heading => (heading.style.display = 'block')
        );
    }

    /**
     * Resets UI to the state when the app just got launched.
     */
    resetUI() {
        const self = this;

        clearInterval(self._updateInterval);

        self._timerEnd.innerText = '0:00';
        self._timerStart.innerText = '0:00';
        self._songName.innerText = 'Something';
        self._artist.innerText = 'Someone';

        self._playButton.style.backgroundImage = 'url("../src/img/play.png")';
        self._progress.value = 0;

        self._albumCover.style.removeProperty('background-image');

        self._shuffle.style.backgroundImage = 'url("../src/img/shuffle.png")';

        if (self._albumCoverImage) {
            self._albumCoverImage.src = ''; // <- Fails on purpose, gets handled in updateUI
        }

        if (self._currentlyPlaying) {
            self._currentlyPlaying.classList.remove('song-container-active');
            self._currentlyPlaying = undefined;
        }
    }

    /**
     * Adds meta data to all song entries.
     * @param {Object} Main 
     * @return {Array<Object>}
     */
    updateSongListMetaData(Main) {
        const updatedList = [];
        const songs = document.querySelectorAll('div[data-file-path]');
        for (let i = 0; i < Main.files.length; i++) {
            const data = songs[i].getElementsByTagName('div');
            const entry = {
                name: data[0].innerText,
                album: data[1].innerText,
                artist: data[2].innerText,
                path: Main.files[i].path
            };
            updatedList.push(entry);
        }
        return updatedList;
    }

    /**
     * Highlights the click sorting button.
     * @param {HTMLElement} element 
     */
    markSort(element) {
        element.style.color = 'var(--song-con-active)';
    }

    /**
     * Resets color of clicked sorting button.
     * @param {HTMLElement} element 
     */
    unmarkSort(element) {
        if (element) {
            element.style.color = 'var(--text-color)';
        }
    }

    /**
     * Displays meta data, song length, current timestamp, and album cover.
     * @param {Object} Main 
     * @param {Object} Player 
     */
    updateUI(Main, Player) {
        const self = this;

        const audio = Player.audioPlayer;
        const songs = document.querySelectorAll('div[data-file-path]');

        if (self._currentlyPlaying) {
            self._currentlyPlaying.classList.remove('song-container-active');
        }

        if (!Main.files[0].album) {
            Main.files = self.updateSongListMetaData(Main);
        }

        self._updateInterval = setInterval(() => {
            const fullTimeSeconds = audio.duration;
            const fullTimeMinutes = Math.floor(fullTimeSeconds / 60);
            const fullTimeRest = Math.floor(fullTimeSeconds % 60);

            const currentTimeSeconds = audio.currentTime;
            const currentTimeMinutes = Math.floor(currentTimeSeconds / 60);
            const currentTimeRest = Math.floor(currentTimeSeconds % 60);

            self._timerStart.innerText =
                currentTimeRest < 10 ?
                `${currentTimeMinutes}:0${currentTimeRest}` :
                `${currentTimeMinutes}:${currentTimeRest}`;

            self._timerEnd.innerText =
                fullTimeRest < 10 ?
                `${fullTimeMinutes}:0${fullTimeRest}` :
                `${fullTimeMinutes}:${fullTimeRest}`;

            try {
                self._progress.value = 100 * (audio.currentTime / audio.duration);
            } catch (e) {
                // i don't care
            }
        }, 500);

        const index = Player.index;

        self._musicMetadata.parseFile(Main.files[index].path).then(
            metadata => {
                const pic =
                    (metadata.common.picture && metadata.common.picture.length) >= 1 ?
                    metadata.common.picture[0] :
                    null;
                if (pic) {
                    const url = `data:${pic.format};base64,${pic.data.toString(
            'base64'
          )}`;
                    self._albumCoverImage = new Image(1, 1);
                    const img = self._albumCoverImage;
                    img.src = url;
                    img.onerror = () => self.updateTitlebarColor(Main, undefined);
                    img.onload = () => {
                        self._albumCover.style.backgroundImage = `url("${url}")`;
                        self.updateTitlebarColor(Main, self._albumCoverImage);
                    };
                } else {
                    self._albumCover.style.removeProperty('background-image');
                    if (self._albumCoverImage) self._albumCoverImage.src = ''; // <- this will fail on purpose
                }
            },
            err => console.error(err)
        );

        self._songName.innerText = Main.files[index].name;
        self._artist.innerText = Main.files[index].artist;
        self._currentlyPlaying = [...songs].find(song => {
            return song.firstChild.innerText === Main.files[index].name;
        });
        self._currentlyPlaying.classList.add('song-container-active');
    }

    /**
     * Toggles between play or pause button.
     * @param {Object} Player 
     */
    togglePlayButton(Player) {
        const self = this;
        let url;

        if (Player.isPaused) {
            clearInterval(self._updateInterval);
            url = 'url("../src/img/play.png")';
        } else {
            url = 'url("../src/img/pause.png")';
        }
        self._playButton.style.backgroundImage = url;
    }

    /**
     * Shows a visual indication whether endless-repeat is activated.
     * @param {Object} Player 
     */
    _toggleRepeat(Player) {
        const self = this;
        Player.repeat = !Player.repeat;
        self._repeat.style.backgroundImage = Player.repeat ?
            'url("../src/img/repeat-active.png")' :
            'url("../src/img/repeat.png")';
    }

    /**
     * Shows a visual indication whether the playlist is shuffled or not.
     * @param {Object} Main 
     * @param {Object} Player 
     */
    _toggleShuffle(Main, Player) {
        if (Main.files.length === 0) {
            return;
        }

        const self = this;
        // Use a "cached" value, actual value gets changed by Player
        const cachedIsShuffled = !Player.isShuffled;
        self._shuffle.style.backgroundImage = cachedIsShuffled ?
            'url("../src/img/shuffle-active.png")' :
            'url("../src/img/shuffle.png")';

        Player.toggleShuffle(Main, self);
    }

    /**
     * Updates color of title bar.
     * @param {Object} Main
     * @param {Object} image
     */
    updateTitlebarColor(Main, image) {
        /**
         * Converts a single number to hex.
         * @param {number} c 
         */
        function componentToHex(c) {
            const hex = c.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }

        /**
         * Converts an rgb color to a hex color.
         * @param {number} r 
         * @param {number} g 
         * @param {number} b 
         */
        function rgbToHex(r, g, b) {
            return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
        }

        const analyze = require('rgbaster');
        const { Color } = require('custom-electron-titlebar');

        const enabled =
            localStorage.getItem('fancy-titlebar-enabled') === 'true' ? true : false;
        if (!enabled) {
            Main.titlebar.updateBackground(Color.fromHex('#002a4d'));
            return;
        }

        // Reset if no album cover
        if (!image || image.src === '') {
            Main.titlebar.updateBackground(Color.fromHex('#002a4d'));
            return;
        }

        const url = image.src;
        analyze(url, { scale: 0.3 })
            .then(result => {
                let color = result[0].color;
                color = color.split('(')[1];
                color = color.split(')')[0];
                color = color.split(',');
                const hex = rgbToHex(
                    Number.parseInt(color[0]),
                    Number.parseInt(color[1]),
                    Number.parseInt(color[2])
                );
                Main.titlebar.updateBackground(Color.fromHex(hex));
            })
            .catch(err => console.error(err));
    }

    get albumCoverImage() {
        const self = this;
        return self._albumCoverImage;
    }
};