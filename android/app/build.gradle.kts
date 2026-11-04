plugins {
    id("com.android.application")
}

// Os arquivos do jogo (a mesma versão do site) são copiados para dentro do APK.
val webRoot = rootProject.projectDir.parentFile
val webAssets = layout.buildDirectory.dir("generated/web-assets")
val copyWebAssets by tasks.registering(Sync::class) {
    from(webRoot) {
        include("index.html", "logic.js", "manifest.webmanifest", "icons/**", "fonts/**")
    }
    into(webAssets.map { it.dir("www") })
}

// Número da versão: vem do GitHub Actions (número do build); localmente usa 1.
val buildNumber = (findProperty("buildNumber") as String?)?.toIntOrNull() ?: 1

android {
    namespace = "com.brancoviana.azulejo"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.brancoviana.azulejo"
        minSdk = 24
        targetSdk = 35
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"
    }

    signingConfigs {
        // Chave SÓ PARA TESTES, guardada no repositório para que cada APK novo
        // instale por cima do anterior. Para a Play Store, crie uma chave própria e secreta.
        create("teste") {
            storeFile = file("teste.keystore")
            storePassword = "azulejo-teste"
            keyAlias = "teste"
            keyPassword = "azulejo-teste"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("teste")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main") {
            assets.srcDir(webAssets)
        }
    }
}

tasks.named("preBuild") { dependsOn(copyWebAssets) }

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
