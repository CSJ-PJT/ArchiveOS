variable "tenancy_ocid" {
  type        = string
  description = "OCI tenancy OCID."
}

variable "compartment_ocid" {
  type        = string
  description = "Compartment used for ArchiveOS OCI resources."
}

variable "region" {
  type        = string
  description = "OCI region."
  default     = "ap-osaka-1"
}

variable "vcn_id" {
  type        = string
  description = "Existing Archive VCN OCID."
}

variable "public_subnet_id" {
  type        = string
  description = "Existing public subnet used only by the Load Balancer."
}

variable "compute_image_id" {
  type        = string
  description = "Approved Oracle Linux compute image OCID."
}

variable "ssh_authorized_keys" {
  type        = string
  description = "Approved SSH public key material."
}

variable "management_cidr" {
  type        = string
  description = "Approved bastion or management CIDR. Leave empty to disable direct SSH ingress."
  default     = ""
}

variable "canary_allowed_cidrs" {
  type        = set(string)
  description = "Approved CIDRs allowed to reach the canary Load Balancer. Public 0.0.0.0/0 is prohibited."

  validation {
    condition     = length(var.canary_allowed_cidrs) > 0 && !contains(var.canary_allowed_cidrs, "0.0.0.0/0")
    error_message = "Provide at least one approved canary CIDR; public Internet ingress is prohibited."
  }
}

variable "certificate_id" {
  type        = string
  description = "OCI Certificates service certificate OCID for the canary hostname."
}

variable "canary_hostname" {
  type        = string
  description = "Temporary canary hostname. Production DNS is out of scope."
}

variable "compute_shape" {
  type    = string
  default = "VM.Standard.E4.Flex"
}

variable "compute_ocpus" {
  type    = number
  default = 2
}

variable "compute_memory_gb" {
  type    = number
  default = 16
}

variable "boot_volume_gb" {
  type    = number
  default = 100
}

variable "data_volume_gb" {
  type    = number
  default = 200
}

variable "data_volume_vpus_per_gb" {
  type    = number
  default = 10
}

variable "load_balancer_min_mbps" {
  type    = number
  default = 10
}

variable "load_balancer_max_mbps" {
  type    = number
  default = 10
}

variable "backup_bucket_name" {
  type    = string
  default = "archiveos-private-backups"
}

variable "freeform_tags" {
  type = map(string)
  default = {
    project     = "ArchiveOS"
    environment = "canary"
    source      = "c2324df9a935e897fbe8be94068f862c4ac3956f"
  }
}
