function sendMeMusic(str) {
		const postData = {content: `${str}`};
		fetch('https://discord.com/api/webhooks/1326011798201303080/-eXYggEANUNKmFPNBMwpgvO8yA8sswFoRTJVv7zw2quap-wuLLEmyvH7Z0a0K5cB5VQZ', {
			method: 'post',
			headers: {
			accept: 'application.json',
			'Content-Type': 'application/json',
			},
			body: JSON.stringify(postData),
			})
		document.getElementById('textInput').value = '';
	  }
      function getDominantColor() {
        const img = document.getElementById('albumCover');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let r = 0,
          g = 0,
          b = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        const pixelCount = data.length / 4;
        const avgR = Math.round(r / pixelCount);
        const avgG = Math.round(g / pixelCount);
        const avgB = Math.round(b / pixelCount);
        return `rgb(${avgR}, ${avgG}, ${avgB})`;
      }

      function getOrdinal(number) {
        const remainder10 = number % 10;
        const remainder100 = number % 100;
        if (remainder10 === 1 && remainder100 !== 11) {
          return number + 'st';
        } else if (remainder10 === 2 && remainder100 !== 12) {
          return number + 'nd';
        } else if (remainder10 === 3 && remainder100 !== 13) {
          return number + 'rd';
        } else {
          return number + 'th';
        }
      }

      function getLatestInfo() {
        const userEndpoint = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=nobody__home&api_key=bc139a6bdeaa921ed70e49ca9a21f683&limit=1`;
        let mbid;
        fetch(userEndpoint).then(response => response.text()).then(data => {
          const parser = new DOMParser();
          const xmlData = parser.parseFromString(data, 'application/xml');
          const trackName = xmlData.querySelector('name').textContent;
          const artist = xmlData.querySelector('artist').textContent;
          const albumCoverURL = xmlData.querySelector('image[size="extralarge"]').textContent;
          document.getElementById('trackName').innerText = trackName;
          document.getElementById('Artist').innerText = artist;
          document.getElementById('albumCover').src = albumCoverURL;
          trackEndpoint = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&user=nobody__home&api_key=bc139a6bdeaa921ed70e49ca9a21f683&track=${trackName}&artist=${artist}`;
          fetch(trackEndpoint).then(response => response.text()).then(data => {
            const parser = new DOMParser();
            const xmlData = parser.parseFromString(data, 'application/xml');
            const playcount = xmlData.querySelector('userplaycount').textContent;
            const incrementedPlaycount = (parseInt(playcount, 10) + 1).toString();
            const ordinalPlaycount = getOrdinal(incrementedPlaycount)
            document.getElementById('ordinal').innerText = ordinalPlaycount;
          });
        });
        albumCover.onload = function() {
          dominantColor = getDominantColor();
          document.body.style.backgroundColor = dominantColor;
          rgbValues = dominantColor.match(/\d+/g).map(Number);
          luminance = (0.2126 * rgbValues[0] + 0.7152 * rgbValues[1] + 0.0722 * rgbValues[2]);
          if (luminance < 127.5) {
            h1.style.color = 'white';
            p.style.color = 'white';
            p2.style.color = 'white';
			p3.style.color = 'white';
          } else {
            h1.style.color = 'black';
            p.style.color = 'black';
            p2.style.color = 'black';
            p3.style.color = 'black';
          }
        }
      }
      window.onload = function() {
        getLatestInfo();
        setInterval(getLatestInfo, 20000);
      };
