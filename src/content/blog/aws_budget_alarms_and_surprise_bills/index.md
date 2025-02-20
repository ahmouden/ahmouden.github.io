---
title: "AWS Budget Alarms and Surprise Bills"
summary: "What is AWS Budget service (AKA Billing and Cost Management) and how can we use it to not go broke?"
date: "Nov 25 2024"
draft: false
tags:
- AWS
- AWS Budget
- FinOps
---

# Budget Alarms and Surprise Bills

Budget alarms is configuring billing monitoring and alerting to notify you if your AWS bill ever **exceeds** or is **forecasted to exceed** a certain budget limit.

This is good in case if you forgot to turn off or delete resources and end up with an unexpected bill.

The story is always the same, you try something out, be done with it, delete all resources, overlook some small errors, don't make a big deal of them, and finally it turns out the error is about some resource(s) that didn't get deleted and now you have a surprise bill in your hands.

But Thankfully AWS is known to be forgiven with your first surprise bill, even if it is in the range of the thousands of dollars.

[This guy](https://roman.pt/posts/aws-surprise-bill/) did a workshop and after he was done he deleted all the resources used for the workship, but an Amazon MQ Broker failed to get deleted by CloudFormation. The bill was 300$, and Amazon Support reversed it.

[This other guy](https://chrisshort.net/the-aws-bill-heard-around-the-world/) got a 2700$ bill because of a CDN trying and failing to cache a disk image stored in an S3 bucket. Support reversed the bill after he explained what happened.

The first guy didn't **know** that he missed a resource, which meant it kept on running and increasing the bill. While the second guy made a wrong assumption (most of the problems come from false assumptions) that CloudFlare CDN supported the caching of the **type** and **size** of the **13 GB** disk image he was hosting on an S3 bucket (btw CloudFlare supported neither), but that was the problem that caused a very high number of requests to hit the S3 bucket to GET the image instead of getting it from the CDN. It took them both **two** months to receive the bill and to actually realize their mistakes.

If they had set up a budget alert to notify them that their budget exceeded a certain number, they would have known in minutes or hours and quickly acted to detect and respond to fix the problem rather than waiting for two months to receive the bill and then be surprised.

# Enable Budgets
![AWS Billing and Cost Management](f9389cc09fc253f1e30a661df0651707_kix.6op2tzirk8lf.webp)
Billing and Cost Management is the service we gonna use to set up our budget.

Let's search for it in the search bar
![search for the Budget service](<Pasted image 20241126004519.png>)
I already have two budgets setup, but we'll see how to create a budget
![Budgets dashboard](<Pasted image 20241126004810.png>)

To create a budget, click on the yellow **Create budget** button, and then you'll be presented with the following options:
1. Budget Setup: Simple(use a template) or Advanced(customize for your own use case) **=> Going with a template for this one**
2. 4 templates to choose from:
	- Zero Spend: notify once budget exceeds `$0.01`
	- Monthly Cost: notify when budget exceeds or forecasted to exceed the budget amount **=> using this one for the example**
	- Daily Savings Plan Coverage: This type of budget helps you monitor how much usage is covered by your savings plan, and that you are not paying full price for a service that you have a service plan for
	- Daily Reservation Utilization: You reserved some service capacity (EC2) for the next year. This budget tracks how much you used the reserved capacity on a given day
3. Budget name
4. Budget amount
5. Who to notify by email (max is 10 emails)
6. Scope: all services

For the example I created a budget of type **Cost budget**, of amount `$1 000 000.00`, with the name of **My Example Monthly Cost Budget**.

It is important to note that you'll get a notification email in 3 scenarios:
- You actually spent **85%** of the budget amount
- Your forecasted spend is expected to reach **100%** of the budget
- You actually spent **100%** of the budget
![When budget alarms are sent](<Pasted image 20241126010839.png>)

And here is my created budget:
![Newly created budget](<Pasted image 20241126010601.png>)

Besides securing the root user, setting up a budget(s) should be the very next thing after creating a new AWS account, because that way you'll also secure your bank account.