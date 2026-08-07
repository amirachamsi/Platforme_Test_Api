package com.bct.back.services;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.beans.factory.ObjectProvider;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final Environment environment;

    public void sendVerificationCode(String to, String code) {
        String subject = "Confirmation de modification de profil";
        String text = "Votre code de confirmation est : " + code + "\n" +
                "Si vous n'avez pas demandé cette modification, ignorez ce message.";

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        String mailHost = environment.getProperty("spring.mail.host");

        if (mailSender == null || !StringUtils.hasText(mailHost)) {
            log.info("[EMAIL SIMULÉ] To={} Subject={} Body={}", to, subject, text);
            return;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject(subject);
        message.setText(text);

        try {
            mailSender.send(message);
            log.info("Email de vérification envoyé à {}", to);
        } catch (MailException exception) {
            log.error("Impossible d'envoyer l'email de vérification à {}", to, exception);
            throw new RuntimeException("Impossible d'envoyer l'email de confirmation");
        }
    }
}
