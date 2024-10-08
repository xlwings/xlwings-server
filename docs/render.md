# Render.com

[Render](https://render.com/) offers a free tier that can be used to test-drive xlwings Server. The fastest way (less than a minute) is to deploy the official Docker container. This means, however, that you will only be able to try out the examples that ship with xlwings Server. If you'd like to make changes to the repo, you would need to connect to your own repository. This means, you'll need to set up your own repo first and building the service might take up to a few minutes. Let's look at both of these options!

## Deploy a single Docker container

1. On the [Render dashboard](https://dashboard.render.com/), click on `+ New` on the top right and select `Web Service` in the dropdown.
2. Activate the `Existing Image` tab and paste `xlwings/xlwings-server` as the Image URL. Then click on `Connect`.
3. Select a `Region` that's close to you (optional).
4. Under `Instance Type`, select an appropriate plan. `Free` is good enough for a test drive.
5. Under `Environment Variables`, add `XLWINGS_LICENSE_KEY` as `NAME_OF_VARIABLE` and your [license key](https://www.xlwings.org/trial) as `value`.
6. Click on `Deploy Web Service`. After less than 1 minute, you should see: `Your service is live 🎉`.
7. Click on the URL of your service (e.g., https://yourname.onrender.com). If you see `{"status": "ok"}`, everything is working correctly.

```{note}
- The free plan spins down with inactivity, which means that next time you're using your Excel add-in, it will take around 30 seconds until xlwings Server will be available again.
- This setup lets you test everything, but since it runs a single container, it is most likely not suitable for production.
```

## Deploy from a Git repository

1. [Set up your own repo](repo_setup.md)
2. On the [Render dashboard](https://dashboard.render.com/), click on `+ New` on the top right and select `Web Service` in the dropdown.
3. Under `Git Provider`, select your repo, then `Connect`. If you haven't connected with your Git provider previously, you'll need to do that first.
4. Select a `Region` that's close to you (optional).
5. Under `Instance Type`, select an appropriate plan. `Free` is good enough for a test drive.
6. Under `Environment Variables`, add `XLWINGS_LICENSE_KEY` as `NAME_OF_VARIABLE` and your [license key](https://www.xlwings.org/trial) as `value`.
7. Click on `Deploy Web Service`. After a couple of minutes, you should see: `Your service is live 🎉`.
8. Click on the URL of your service (e.g., https://yourname.onrender.com). If you see `{"status": "ok"}`, everything is working correctly.

```{note}
- The free plan spins down with inactivity, which means that next time you're using your Excel add-in, it will take around 30 seconds until xlwings Server will be available again.
- This setup lets you test everything, but since it runs a single container, it is most likely not suitable for production.
- Every time you push something to your repo, the xlwings Server web service will be updated automatically.
```

## Deploy for production

Render offers everything for a production setup:

- Managed Redis database
- Allows to run the xlwings Server app and the Socket.IO service in separate containers

TODO: add render blueprint and more detailed instructions.
