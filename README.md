# kofi-discord-notification [![Netlify Status](https://api.netlify.com/api/v1/badges/028bea5f-00d6-4679-bbff-456f4251e01d/deploy-status)](https://app.netlify.com/sites/kofi-discord-notification/deploys)
Serverless Express app running on Netlify functions to send Ko-fi notification to Discord.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/P5P6D65UW)

## Why?
Ko-fi currently has Discord Integration which only does role assignment but not message notification on donation. I found [a Node.js script](https://github.com/eramsorgr/kofi-discord-alerts) to achieve this goal but unfortunately it needed a constantly running server environment, as well as your own domain to avoid exposing the server IP address. Hence, I modified it to make it run on [Netlify Functions](https://functions.netlify.com/), and you also get a free Netlify subdomain.

You can also deploy this simple script on an already existing Netlify website if you have one, just remember to include the extra dependencies in your main `package.json` and update your env variables.

## How?
1. Click this button<br><br>[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/raidensakura/kofi-discord-notification)  

2. Fill your environmental variables<br><br>![Screenshot 2023-01-01 200539](https://user-images.githubusercontent.com/38610216/210170197-b7f31dd5-3c81-40eb-8997-6990250bcf04.png)  

3. Save & Deploy

4. Access your function at: `https://<your_domain>.netlify.app/.netlify/functions/kofi`<br><br>![image](https://user-images.githubusercontent.com/38610216/210170195-3eca1cfb-fa5c-4763-ba17-567900688876.png)

5. [Edit your Webhook URL on Ko-fi](https://ko-fi.com/manage/webhooks)

6. [Test your webhook](https://ko-fi.com/manage/webhooks#postSingleDonationTestMessageBtn)<br><br>![image](https://user-images.githubusercontent.com/38610216/210170513-42bb56e7-1559-4088-80d1-c261f295af3d.png)

## Where?
- Discord Webhook URL (Under channel settings):<br><br>![image](https://user-images.githubusercontent.com/38610216/210170804-02a5a3fe-b3db-4cca-b006-201bbe0fa518.png)

- [Ko-fi Token](https://ko-fi.com/manage/webhooks?src=sidemenu) (Under advanced):<br><br>![Screenshot 2023-01-01 204241](https://user-images.githubusercontent.com/38610216/210170905-0e274abc-74f4-46ee-9e3b-cd87a5cadcdf.png)

## Help
Feel free to reach out to me on [Discord](https://dsc.gg/transience) or [Create an issue](https://github.com/raidensakura/kofi-discord-notification/issues/new)
