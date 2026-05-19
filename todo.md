## TODO

1. Handle billing well if the user had free minutes and then credits his or her account, the free minutes should be used up first before user credits is used. Or better yet if the user has free minutes it should be exhausted first, before the user's plan or credits are used.
2. Try to parse all date from UTC date to local time.
3. Implement a fully working admin dashboard
4. Make audio sessions work on firefox and safari browsers.
5. Create a fully working billing system.
6. Make minor tweaks for mobile responsiveness.
7. Optimize PDF generation.

**gcloud login
**gcloud storage buckets update gs://legal-51aee.firebasestorage.app --cors-file=storage-cors.json
\_\_gcloud storage buckets describe gs://legal-51aee.firebasestorage.app --format="default(cors_config)"
