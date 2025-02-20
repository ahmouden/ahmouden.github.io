import ipaddress

# Define the IP address and range
ip = ipaddress.ip_address("104.102.221.250")

ip_is_aws_service = False 
with open("all_ip_ranges", 'r') as file:
    for line in file:
        ip_range = ipaddress.ip_network(line.rstrip(), strict=False)
        if ip in ip_range:
            ip_is_aws_service = True
            print(f"{ip} is within the range {ip_range}")

if ip_is_aws_service is False:
    print(f"{ip} is NOT an AWS Service")
