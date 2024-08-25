storage "file" {
        path = "/mnt/vault/data"
}
listener "tcp" {
        address = "0.0.0.0:8200"
        tls_disable = 1
}
seal "awskms" {
        region     = "ap-southeast-2"
        kms_key_id = "KMS_ID"
}
ui = true
