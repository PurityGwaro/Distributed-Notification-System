 const config = new DocumentBuilder()
     .setTitle('Template service API')
     .setDescription('Template management service')
     .setVersion('1.0')
     .build();
 
   const document = SwaggerModule.createDocument(app, config);
   SwaggerModule.setup('api/docs', app, document);
