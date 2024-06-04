storage "consul" {
        address = "127.0.0.1:8500"
        path = "vault/"
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
