resource "oci_load_balancer_load_balancer" "archiveos" {
  compartment_id = var.compartment_ocid
  display_name   = "archiveos-canary-lb"
  shape          = "flexible"
  subnet_ids     = [var.public_subnet_id]
  network_security_group_ids = [
    oci_core_network_security_group.load_balancer.id
  ]

  shape_details {
    minimum_bandwidth_in_mbps = var.load_balancer_min_mbps
    maximum_bandwidth_in_mbps = var.load_balancer_max_mbps
  }

  freeform_tags = var.freeform_tags
}

resource "oci_load_balancer_backend_set" "archiveos" {
  load_balancer_id = oci_load_balancer_load_balancer.archiveos.id
  name             = "archiveos-canary-backends"
  policy           = "ROUND_ROBIN"

  health_checker {
    protocol          = "HTTP"
    port              = 8080
    url_path          = "/health"
    return_code       = 200
    retries           = 3
    timeout_in_millis = 3000
    interval_ms       = 10000
  }
}

resource "oci_load_balancer_backend" "archiveos" {
  load_balancer_id = oci_load_balancer_load_balancer.archiveos.id
  backendset_name  = oci_load_balancer_backend_set.archiveos.name
  ip_address       = data.oci_core_vnic.archiveos.private_ip_address
  port             = 8080
  weight           = 1
}

resource "oci_load_balancer_listener" "https" {
  load_balancer_id         = oci_load_balancer_load_balancer.archiveos.id
  name                     = "archiveos-canary-https"
  default_backend_set_name = oci_load_balancer_backend_set.archiveos.name
  port                     = 443
  protocol                 = "HTTP"

  ssl_configuration {
    certificate_ids         = [var.certificate_id]
    verify_peer_certificate = false
    protocols               = ["TLSv1.2", "TLSv1.3"]
  }
}

resource "oci_load_balancer_rule_set" "https_redirect" {
  load_balancer_id = oci_load_balancer_load_balancer.archiveos.id
  name             = "archiveos-canary-https-redirect"

  items {
    action        = "REDIRECT"
    response_code = 301
    redirect_uri {
      protocol = "HTTPS"
      host     = "{host}"
      port     = 443
      path     = "{path}"
      query    = "{query}"
    }
  }
}

resource "oci_load_balancer_listener" "http" {
  load_balancer_id         = oci_load_balancer_load_balancer.archiveos.id
  name                     = "archiveos-canary-http"
  default_backend_set_name = oci_load_balancer_backend_set.archiveos.name
  port                     = 80
  protocol                 = "HTTP"
  rule_set_names           = [oci_load_balancer_rule_set.https_redirect.name]
}
